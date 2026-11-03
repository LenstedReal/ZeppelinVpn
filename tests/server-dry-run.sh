#!/usr/bin/env bash
# Runs server/zeppelin-oracle-setup.sh against stubbed system commands:
# no root, no network, no real WireGuard or iptables needed. Used by tests/server.test.ts.
# Optional: ZEPPELIN_DRYRUN_OUT=<dir> keeps the generated phone profile there.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/server/zeppelin-oracle-setup.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/home/ubuntu" "$T/state"

stub() { cat > "$T/bin/$1"; chmod +x "$T/bin/$1"; }

stub id <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "-u" ]; then echo 0; else exec /usr/bin/id "$@"; fi
EOF
for c in apt-get debconf-set-selections netfilter-persistent chown; do
  stub "$c" <<'EOF'
#!/usr/bin/env bash
# only debconf-set-selections reads stdin; the others must not wait for input
if [ "$(basename "$0")" = "debconf-set-selections" ]; then cat >/dev/null 2>&1 || true; fi
echo "$(basename "$0") $*" >> "$STUB_STATE/calls"
EOF
done
stub sysctl <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "-n" ]; then echo 1; fi
EOF
stub ufw <<'EOF'
#!/usr/bin/env bash
echo "Status: inactive"
EOF
stub systemctl <<'EOF'
#!/usr/bin/env bash
case "$1" in
  enable) exit 0 ;;
  is-active) [ -f "$STUB_STATE/active" ] ;;
  start|restart) touch "$STUB_STATE/active" "$STUB_STATE/wg_up" ;;
  *) exit 0 ;;
esac
EOF
stub ip <<'EOF'
#!/usr/bin/env bash
echo "default via 10.0.0.1 dev ens3 proto dhcp src 10.0.0.42 metric 100"
EOF
stub curl <<'EOF'
#!/usr/bin/env bash
echo "129.151.10.20"
EOF
stub getent <<'EOF'
#!/usr/bin/env bash
[ "$1" = "passwd" ] && [ "$2" = "ubuntu" ] && echo "ubuntu:x:1001:1001::$STUB_HOME:/bin/bash"
EOF
stub wg <<'EOF'
#!/usr/bin/env bash
case "$1" in
  genkey|genpsk) head -c 32 /dev/urandom | base64 ;;
  pubkey) read -r k; printf '%s' "$k" | openssl dgst -sha256 -binary | base64 ;;
  show)
    [ -f "$STUB_STATE/wg_up" ] || exit 1
    case "${3:-}" in
      listen-port) echo 51820 ;;
      latest-handshakes) [ -f "$STUB_STATE/peers" ] && awk '{print $1 "\t0"}' "$STUB_STATE/peers" ;;
    esac ;;
  set)
    if [ "${5:-}" = "remove" ]; then
      grep -vxF "$4" "$STUB_STATE/peers" > "$STUB_STATE/peers.tmp" || true
      mv "$STUB_STATE/peers.tmp" "$STUB_STATE/peers"
    else
      echo "$4" >> "$STUB_STATE/peers"
    fi ;;
esac
EOF
stub iptables <<'EOF'
#!/usr/bin/env bash
table=filter
if [ "$1" = "-t" ]; then table="$2"; shift 2; fi
op="$1"; chain="$2"; shift 2
if [ "$op" = "-I" ] && [ "${1:-}" = "1" ]; then shift; fi
key="$table $chain $*"
case "$op" in
  -C) grep -qxF -- "$key" "$STUB_STATE/rules" 2>/dev/null ;;
  -I) echo "$key" >> "$STUB_STATE/rules" ;;
  -D) grep -vxF -- "$key" "$STUB_STATE/rules" > "$STUB_STATE/rules.tmp" || true; mv "$STUB_STATE/rules.tmp" "$STUB_STATE/rules" ;;
  *) exit 2 ;;
esac
EOF

export PATH="$T/bin:$PATH"
export STUB_STATE="$T/state"
export STUB_HOME="$T/home/ubuntu"
export SUDO_USER=ubuntu
export ZEPPELIN_WG_DIR="$T/etc/wireguard"
export ZEPPELIN_SYSCTL_FILE="$T/etc/sysctl.d/99-zeppelin-vpn.conf"
export ZEPPELIN_API_DIR="$T/usr/local/lib/zeppelin"
export ZEPPELIN_UNIT_DIR="$T/etc/systemd/system"
mkdir -p "$ZEPPELIN_UNIT_DIR"
WG_CONF="$ZEPPELIN_WG_DIR/wg0.conf"
CLIENTS="$ZEPPELIN_WG_DIR/zeppelin-clients"

fail() { echo "DRY-RUN FAIL: $*" >&2; exit 1; }
peers() { grep -c '^\[Peer\]' "$WG_CONF" || true; }
run() { bash "$SCRIPT" "$@" > "$T/out.txt" 2>&1; }

run || { cat "$T/out.txt"; fail "install"; }
grep -q -- "----- ZEPPELIN PROFILE BEGIN -----" "$T/out.txt" || fail "profile markers missing"
[ -f "$CLIENTS/telefon.conf" ] || fail "telefon.conf missing"
[ -f "$STUB_HOME/zeppelin-telefon.conf" ] || fail "home copy missing"
[ "$(stat -c %a "$CLIENTS/telefon.conf")" = "600" ] || fail "client file must be 600"
[ "$(stat -c %a "$ZEPPELIN_WG_DIR/server.key")" = "600" ] || fail "server key must be 600"
grep -q "^MTU = 1420" "$WG_CONF" || fail "server MTU"
grep -q "^Endpoint = 129.151.10.20:51820" "$CLIENTS/telefon.conf" || fail "endpoint"
grep -q "^Address = 10.66.66.2/32" "$CLIENTS/telefon.conf" || fail "first client IP"
[ "$(peers)" = "1" ] || fail "expected 1 peer"
[ "$(wc -l < "$STUB_STATE/rules")" = "6" ] || fail "expected 6 firewall rules"
grep -qx "nat POSTROUTING -s 10.66.66.0/24 -o ens3 -m comment --comment zeppelin-vpn -j MASQUERADE" "$STUB_STATE/rules" || fail "NAT rule"
grep -qx "filter INPUT -p udp --dport 51820 -m comment --comment zeppelin-vpn -j ACCEPT" "$STUB_STATE/rules" || fail "INPUT rule"
grep -q "net.ipv4.ip_forward = 1" "$ZEPPELIN_SYSCTL_FILE" || fail "sysctl file"
sed -n '/----- ZEPPELIN PROFILE BEGIN -----/,/----- ZEPPELIN PROFILE END -----/p' "$T/out.txt" | sed '1d;$d' > "$T/printed.conf"
cmp -s "$T/printed.conf" "$CLIENTS/telefon.conf" || fail "printed profile differs from file"

run || { cat "$T/out.txt"; fail "second install"; }
[ "$(peers)" = "1" ] || fail "re-running install must not add peers"
[ "$(wc -l < "$STUB_STATE/rules")" = "6" ] || fail "re-running install must not duplicate rules"
grep -q "Kurulum zaten yapılmış" "$T/out.txt" || fail "idempotency message"

run add tablet || { cat "$T/out.txt"; fail "add tablet"; }
grep -q "^Address = 10.66.66.3/32" "$CLIENTS/tablet.conf" || fail "second client IP"
[ "$(peers)" = "2" ] || fail "expected 2 peers"
if run add tablet; then fail "duplicate name must fail"; fi
if run add 'bad name!'; then fail "invalid name must fail"; fi

run list || fail "list"
grep -q "telefon" "$T/out.txt" || fail "list must show telefon"
grep -q "tablet" "$T/out.txt" || fail "list must show tablet"

run remove telefon || { cat "$T/out.txt"; fail "remove"; }
[ "$(peers)" = "1" ] || fail "expected 1 peer after remove"
[ ! -f "$CLIENTS/telefon.conf" ] || fail "client file not removed"
[ ! -f "$STUB_HOME/zeppelin-telefon.conf" ] || fail "home copy not removed"
grep -q "# Client: tablet" "$WG_CONF" || fail "other client must stay"

run add laptop || fail "add laptop"
grep -q "^Address = 10.66.66.2/32" "$CLIENTS/laptop.conf" || fail "freed IP should be reused"

run status || { cat "$T/out.txt"; fail "status"; }
run show laptop || fail "show"

run public-on "Frankfurt 1" DE || { cat "$T/out.txt"; fail "public-on"; }
grep -q "^Address = 10.66.66.1/24, 10.67.0.1/16$" "$WG_CONF" || fail "public address on wg0"
grep -qx "nat POSTROUTING -s 10.67.0.0/16 -o ens3 -m comment --comment zeppelin-vpn -j MASQUERADE" "$STUB_STATE/rules" || fail "public NAT rule"
grep -qx "filter INPUT -p tcp --dport 51821 -m comment --comment zeppelin-vpn -j ACCEPT" "$STUB_STATE/rules" || fail "API port rule"
grep -q "ZEPPELIN_SERVER_PUBLIC_KEY=$(cat "$ZEPPELIN_WG_DIR/server.pub")" "$ZEPPELIN_UNIT_DIR/zeppelin-public-api.service" || fail "unit pins server key"
python3 -m py_compile "$ZEPPELIN_API_DIR/zeppelin-public-api.py" || fail "API script"
grep -q "apiUrl: 'http://129.151.10.20:51821'" "$T/out.txt" || fail "public-info entry"
grep -q "name: 'Frankfurt 1', country: 'DE'" "$T/out.txt" || fail "public-info name"
run public-on "Frankfurt 1" DE || fail "public-on twice"
[ "$(grep -c '10.67.0.1/16' "$WG_CONF")" = "1" ] || fail "public address must not repeat"
run public-off || fail "public-off"
if grep -q "dport 51821" "$STUB_STATE/rules"; then fail "API port rule must be removed"; fi
if run public-info; then fail "public-info after public-off must fail"; fi

if [ -n "${ZEPPELIN_DRYRUN_OUT:-}" ]; then
  mkdir -p "$ZEPPELIN_DRYRUN_OUT"
  cp "$CLIENTS/laptop.conf" "$ZEPPELIN_DRYRUN_OUT/laptop.conf"
  cp "$WG_CONF" "$ZEPPELIN_DRYRUN_OUT/wg0.conf"
fi
echo "DRY-RUN OK"
