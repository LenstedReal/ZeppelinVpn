#!/usr/bin/env bash
# Zeppelin VPN - WireGuard server setup for Oracle Cloud (Ubuntu 22.04 / 24.04)
#
#   sudo bash zeppelin-oracle-setup.sh              install (safe to run again) + first profile "telefon"
#   sudo bash zeppelin-oracle-setup.sh add NAME     new profile for another device (tablet, laptop...)
#   sudo bash zeppelin-oracle-setup.sh show NAME    print a profile again
#   sudo bash zeppelin-oracle-setup.sh list         profiles and their last handshake
#   sudo bash zeppelin-oracle-setup.sh remove NAME  revoke a profile
#   sudo bash zeppelin-oracle-setup.sh status       health check with fixes
#   sudo bash zeppelin-oracle-setup.sh repair       re-apply forwarding + firewall rules, restart WireGuard
#   sudo bash zeppelin-oracle-setup.sh public-on "Frankfurt" DE
#                                                   shared server: app users connect with one tap
#   sudo bash zeppelin-oracle-setup.sh public-info  the server entry to put into the app
#   sudo bash zeppelin-oracle-setup.sh public-off   stop the shared server
#
# What it fixes compared to a plain "apt install wireguard" on Oracle:
#   * Oracle's Ubuntu image ships iptables rules that end with REJECT in INPUT and FORWARD.
#     Rules appended with -A land after the REJECT and never match, so the handshake or the
#     internet access fails. This script inserts its rules at the top (-I) and saves them with
#     netfilter-persistent so they survive reboots.
#   * Oracle VNICs use MTU 9000; WireGuard would pick 8920 and oversized packets get dropped
#     on the way to phones. The server uses MTU 1420 and the phone profile MTU 1280.
#   * The server's public IP is NAT'ed by Oracle and is not visible on the interface, so it is
#     looked up once and stored.
# The Oracle "Security List" (cloud firewall) cannot be changed from inside the server: add an
# ingress rule for UDP 51820 in the Oracle console yourself (the app's Setup tab shows how).

set -euo pipefail

WG_DIR="${ZEPPELIN_WG_DIR:-/etc/wireguard}"
CLIENT_DIR="${ZEPPELIN_CLIENT_DIR:-$WG_DIR/zeppelin-clients}"
SYSCTL_FILE="${ZEPPELIN_SYSCTL_FILE:-/etc/sysctl.d/99-zeppelin-vpn.conf}"
STATE_FILE="$WG_DIR/zeppelin.env"
WG_IF="wg0"
WG_CONF="$WG_DIR/$WG_IF.conf"
MARKER="# Managed by zeppelin-oracle-setup.sh"
NET4="10.66.66"
SERVER_MTU=1420
CLIENT_MTU=1280
CLIENT_DNS="1.1.1.1, 1.0.0.1"
TAG="zeppelin-vpn"
API_PORT="${ZEPPELIN_API_PORT:-51821}"
PUBLIC_NET="10.67.0.0/16"
PUBLIC_ADDR="10.67.0.1/16"
API_DIR="${ZEPPELIN_API_DIR:-/usr/local/lib/zeppelin}"
UNIT_DIR="${ZEPPELIN_UNIT_DIR:-/etc/systemd/system}"
JOURNALD_DIR="${ZEPPELIN_JOURNALD_DIR:-/etc/systemd/journald.conf.d}"
LOG_DIR="${ZEPPELIN_LOG_DIR:-/var/log}"
API_UNIT="zeppelin-public-api.service"

if [ -t 1 ]; then
  C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_ERR=$'\e[31m'; C_B=$'\e[1m'; C_0=$'\e[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_B=""; C_0=""
fi
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s==> %s%s\n' "$C_B" "$*" "$C_0"; }
ok()   { printf '%s[OK]%s %s\n' "$C_OK" "$C_0" "$*"; }
warn() { printf '%s[UYARI]%s %s\n' "$C_WARN" "$C_0" "$*" >&2; }
bad()  { printf '%s[HATA]%s %s\n' "$C_ERR" "$C_0" "$*" >&2; }
die()  { bad "$*"; exit 1; }

need_root() {
  [ "$(id -u)" -eq 0 ] || die "Root yetkisi gerekli. Komutun başına sudo ekle: sudo bash $0 ${*:-}"
}

check_os() {
  command -v apt-get >/dev/null 2>&1 || die "Bu betik Ubuntu için yazıldı (apt-get bulunamadı). Oracle'da 'Canonical Ubuntu 24.04' imajını seç."
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    [ "${ID:-}" = "ubuntu" ] || warn "Ubuntu dışı bir sistem (${PRETTY_NAME:-?}). Devam ediliyor ama test edilmedi."
  fi
}

valid_ipv4() {
  local ip="$1" a b c d
  [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
  a=${BASH_REMATCH[1]}; b=${BASH_REMATCH[2]}; c=${BASH_REMATCH[3]}; d=${BASH_REMATCH[4]}
  [ "$a" -le 255 ] && [ "$b" -le 255 ] && [ "$c" -le 255 ] && [ "$d" -le 255 ]
}

detect_iface() {
  local dev
  dev="$(ip -4 route show default 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}')"
  [ -n "$dev" ] || die "Varsayılan ağ arayüzü bulunamadı ('ip -4 route show default' boş)."
  printf '%s' "$dev"
}

detect_public_ip() {
  local ip=""
  if [ -n "${ZEPPELIN_PUBLIC_IP:-}" ]; then
    ip="$ZEPPELIN_PUBLIC_IP"
  else
    local url
    for url in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
      ip="$(curl -4 -fsS --max-time 8 "$url" 2>/dev/null | tr -d '[:space:]' || true)"
      valid_ipv4 "$ip" && break
      ip=""
    done
  fi
  valid_ipv4 "$ip" || die "Sunucunun genel IP adresi bulunamadı. Oracle konsolundaki 'Public IP' ile tekrar çalıştır: sudo ZEPPELIN_PUBLIC_IP=1.2.3.4 bash $0"
  printf '%s' "$ip"
}

load_state() {
  PUBLIC_IP=""; IFACE=""; PORT=""
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
  fi
  PORT="${ZEPPELIN_PORT:-${PORT:-51820}}"
}

save_state() {
  umask 077
  cat > "$STATE_FILE" <<EOF
PUBLIC_IP=$PUBLIC_IP
IFACE=$IFACE
PORT=$PORT
EOF
}

install_packages() {
  step "Paketler kuruluyor (wireguard-tools, iptables-persistent)"
  export DEBIAN_FRONTEND=noninteractive
  echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | debconf-set-selections
  echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | debconf-set-selections
  # A fresh Oracle VM often runs unattended-upgrades for a few minutes: wait for the apt lock.
  apt-get -o DPkg::Lock::Timeout=600 update -y
  apt-get -o DPkg::Lock::Timeout=600 install -y wireguard-tools iptables iptables-persistent netfilter-persistent curl
  ok "Paketler hazır"
}

enable_forwarding() {
  step "IP yönlendirme açılıyor"
  mkdir -p "$(dirname "$SYSCTL_FILE")"
  printf 'net.ipv4.ip_forward = 1\n' > "$SYSCTL_FILE"
  sysctl -q -p "$SYSCTL_FILE" >/dev/null
  ok "net.ipv4.ip_forward = 1 (kalıcı)"
}

# ensure TABLE CHAIN RULE... : inserts the rule at the top of the chain unless it already exists.
ensure_rule() {
  local table="$1" chain="$2"
  shift 2
  if ! iptables -t "$table" -C "$chain" "$@" 2>/dev/null; then
    iptables -t "$table" -I "$chain" 1 "$@"
  fi
}

firewall_rules() {
  step "Güvenlik duvarı kuralları (Oracle'ın REJECT kurallarının ÖNÜNE ekleniyor)"
  ensure_rule filter INPUT -p udp --dport "$PORT" -m comment --comment "$TAG" -j ACCEPT
  ensure_rule filter FORWARD -i "$WG_IF" -m comment --comment "$TAG" -j ACCEPT
  ensure_rule filter FORWARD -o "$WG_IF" -m conntrack --ctstate RELATED,ESTABLISHED -m comment --comment "$TAG" -j ACCEPT
  ensure_rule nat POSTROUTING -s "$NET4.0/24" -o "$IFACE" -m comment --comment "$TAG" -j MASQUERADE
  ensure_rule mangle FORWARD -o "$WG_IF" -p tcp --tcp-flags SYN,RST SYN -m comment --comment "$TAG" -j TCPMSS --clamp-mss-to-pmtu
  ensure_rule mangle FORWARD -i "$WG_IF" -p tcp --tcp-flags SYN,RST SYN -m comment --comment "$TAG" -j TCPMSS --clamp-mss-to-pmtu
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$PORT/udp" >/dev/null
    ufw route allow in on "$WG_IF" out on "$IFACE" >/dev/null
    ok "ufw aktif: UDP $PORT ve $WG_IF yönlendirmesine izin verildi"
  fi
  netfilter-persistent save >/dev/null 2>&1 || die "Kurallar kaydedilemedi (netfilter-persistent save)."
  ok "UDP $PORT girişi, $WG_IF yönlendirmesi ve NAT ($IFACE) kalıcı olarak eklendi"
}

server_keys() {
  umask 077
  mkdir -p "$WG_DIR" "$CLIENT_DIR"
  chmod 700 "$WG_DIR" "$CLIENT_DIR"
  if [ ! -s "$WG_DIR/server.key" ]; then
    wg genkey > "$WG_DIR/server.key"
    wg pubkey < "$WG_DIR/server.key" > "$WG_DIR/server.pub"
    ok "Sunucu anahtarları oluşturuldu"
  fi
}

write_server_conf() {
  if [ -f "$WG_CONF" ]; then
    grep -qF "$MARKER" "$WG_CONF" || die "$WG_CONF zaten var ve bu betikle oluşturulmamış. Üzerine yazılmadı. Boş bir sunucu kullan ya da dosyayı yedekleyip kaldır."
    return 0
  fi
  umask 077
  cat > "$WG_CONF" <<EOF
$MARKER
[Interface]
Address = $NET4.1/24
ListenPort = $PORT
MTU = $SERVER_MTU
PrivateKey = $(cat "$WG_DIR/server.key")
EOF
  ok "$WG_CONF yazıldı"
}

start_service() {
  step "WireGuard başlatılıyor"
  systemctl enable --quiet "wg-quick@$WG_IF" || die "wg-quick@$WG_IF otomatik başlatmaya eklenemedi."
  if systemctl is-active --quiet "wg-quick@$WG_IF"; then
    systemctl restart "wg-quick@$WG_IF" || die "WireGuard yeniden başlatılamadı. Ayrıntı: journalctl -u wg-quick@$WG_IF"
  else
    systemctl start "wg-quick@$WG_IF" || die "WireGuard başlatılamadı. Ayrıntı: journalctl -u wg-quick@$WG_IF"
  fi
  wg show "$WG_IF" >/dev/null 2>&1 || die "WireGuard arayüzü ($WG_IF) açılamadı. Ayrıntı: journalctl -u wg-quick@$WG_IF"
  ok "wg-quick@$WG_IF çalışıyor ve açılışta otomatik başlayacak"
}

valid_name() {
  [[ "$1" =~ ^[A-Za-z0-9_-]{1,20}$ ]] || die "Geçersiz ad: '$1' (harf, rakam, - ve _; en fazla 20 karakter)"
}

next_client_ip() {
  local used n
  used=" $(grep -oE "AllowedIPs *= *$NET4\.[0-9]+/32" "$WG_CONF" 2>/dev/null | grep -oE '[0-9]+/32$' | cut -d/ -f1 | tr '\n' ' ') "
  for n in $(seq 2 254); do
    case "$used" in
      *" $n "*) ;;
      *) printf '%s' "$NET4.$n"; return 0 ;;
    esac
  done
  die "Boş IP kalmadı ($NET4.2-254 dolu)."
}

client_conf_path() { printf '%s/%s.conf' "$CLIENT_DIR" "$1"; }

add_client() {
  local name="$1" ip cpriv cpub psk pskfile conf home_copy
  valid_name "$name"
  conf="$(client_conf_path "$name")"
  [ ! -e "$conf" ] || die "'$name' adlı profil zaten var. Tekrar görmek için: sudo bash $0 show $name"
  ip="$(next_client_ip)"
  cpriv="$(wg genkey)"
  cpub="$(printf '%s' "$cpriv" | wg pubkey)"
  psk="$(wg genpsk)"
  umask 077
  cat >> "$WG_CONF" <<EOF

# Client: $name
[Peer]
PublicKey = $cpub
PresharedKey = $psk
AllowedIPs = $ip/32
EOF
  if wg show "$WG_IF" >/dev/null 2>&1; then
    pskfile="$(mktemp)"
    printf '%s\n' "$psk" > "$pskfile"
    wg set "$WG_IF" peer "$cpub" preshared-key "$pskfile" allowed-ips "$ip/32"
    rm -f "$pskfile"
  fi
  cat > "$conf" <<EOF
# Name: Oracle-$name
# Zeppelin VPN profile. Keep it private: anyone with this text can use your server.
[Interface]
PrivateKey = $cpriv
Address = $ip/32
DNS = $CLIENT_DNS
MTU = $CLIENT_MTU

[Peer]
PublicKey = $(cat "$WG_DIR/server.pub")
PresharedKey = $psk
Endpoint = $PUBLIC_IP:$PORT
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
  chmod 600 "$conf"
  home_copy="$(user_copy_path "$name")"
  if [ -n "$home_copy" ]; then
    cp "$conf" "$home_copy"
    chown "$SUDO_USER": "$home_copy"
    chmod 600 "$home_copy"
  fi
  ok "'$name' profili oluşturuldu ($ip)"
}

# Path of the copy in the home of the user who ran sudo (for easy cat/scp), or "" if there is none.
user_copy_path() {
  local owner="${SUDO_USER:-}" home_dir
  [ -n "$owner" ] && [ "$owner" != "root" ] || return 0
  home_dir="$(getent passwd "$owner" 2>/dev/null | cut -d: -f6 || true)"
  [ -n "$home_dir" ] && [ -d "$home_dir" ] || return 0
  printf '%s/zeppelin-%s.conf' "$home_dir" "$1"
}

print_profile() {
  local name="$1" conf
  valid_name "$name"
  conf="$(client_conf_path "$name")"
  [ -f "$conf" ] || die "'$name' adlı profil yok. Liste: sudo bash $0 list"
  say ""
  say "${C_B}Zeppelin VPN profili: $name${C_0}"
  say "Telefonda: Termux'ta aşağıdaki BEGIN ile END arasındaki metni (bu iki satır hariç) seçip kopyala,"
  say "sonra Zeppelin VPN -> Sunucular -> 'Panodan yapıştır'."
  say ""
  say "----- ZEPPELIN PROFILE BEGIN -----"
  cat "$conf"
  say "----- ZEPPELIN PROFILE END -----"
  say ""
  if [ -n "$(user_copy_path "$name")" ] && [ -f "$(user_copy_path "$name")" ]; then
    say "Dosya olarak da kaydedildi: ~/zeppelin-$name.conf (içe aktardıktan sonra silebilirsin: rm ~/zeppelin-$name.conf)"
  fi
  say "Bu metni kimseyle paylaşma: sunucuna erişim anahtarıdır."
}

list_clients() {
  local f name pub hs now
  now="$(date +%s)"
  say "Profiller:"
  shopt -s nullglob
  for f in "$CLIENT_DIR"/*.conf; do
    name="$(basename "$f" .conf)"
    pub="$(awk -v n="# Client: $name" '$0 == n {found = 1; next} found && /^PublicKey/ {print $3; exit}' "$WG_CONF")"
    hs="$(wg show "$WG_IF" latest-handshakes 2>/dev/null | awk -v p="$pub" '$1 == p {print $2}')"
    if [ -n "$hs" ] && [ "$hs" != "0" ]; then
      say "  - $name  $(grep -m1 '^Address' "$f" | awk '{print $3}')  son el sıkışma: $(( now - hs )) sn önce"
    else
      say "  - $name  $(grep -m1 '^Address' "$f" | awk '{print $3}')  henüz bağlanmadı"
    fi
  done
  shopt -u nullglob
}

remove_client() {
  local name="$1" conf pub tmp home_copy
  valid_name "$name"
  conf="$(client_conf_path "$name")"
  [ -f "$conf" ] || die "'$name' adlı profil yok."
  pub="$(awk -v n="# Client: $name" '$0 == n {found = 1; next} found && /^PublicKey/ {print $3; exit}' "$WG_CONF")"
  if [ -n "$pub" ] && wg show "$WG_IF" >/dev/null 2>&1; then
    wg set "$WG_IF" peer "$pub" remove
  fi
  tmp="$(mktemp)"
  # Drop the "# Client: name" block (comment line up to the next blank line).
  awk -v n="# Client: $name" '
    $0 == n { skip = 1; next }
    skip && /^[[:space:]]*$/ { skip = 0; next }
    !skip { print }
  ' "$WG_CONF" > "$tmp"
  cat "$tmp" > "$WG_CONF"
  rm -f "$tmp" "$conf"
  home_copy="$(user_copy_path "$name")"
  [ -z "$home_copy" ] || rm -f "$home_copy"
  ok "'$name' profili kaldırıldı (bu profille artık bağlanılamaz)"
}

# ------------------------------------------------------------------ shared server mode

write_api() {
  mkdir -p "$API_DIR"
  cat > "$API_DIR/zeppelin-public-api.py" <<'PYEOF'
#!/usr/bin/env python3
"""Zeppelin VPN shared-server registration API.

Lets the app connect to your server with one tap: the phone creates its own
WireGuard key pair, sends only the PUBLIC key here, and gets back a tunnel
address. Private keys never leave the phones. The app pins the server's
WireGuard public key, so a tampered HTTP response cannot redirect the tunnel.

Started by systemd (zeppelin-public-api.service), installed by
"zeppelin-oracle-setup.sh public-on". Standard library only.
"""
import ipaddress
import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

WG_IF = os.environ.get("ZEPPELIN_WG_IF", "wg0")
LISTEN_PORT = int(os.environ.get("ZEPPELIN_API_PORT", "51821"))
STATE_FILE = os.environ.get("ZEPPELIN_PUBLIC_STATE", "/etc/wireguard/zeppelin-public.json")
POOL = ipaddress.ip_network(os.environ.get("ZEPPELIN_PUBLIC_POOL", "10.67.0.0/16"))
MAX_PEERS = int(os.environ.get("ZEPPELIN_MAX_PEERS", "150"))
EXPIRE_DAYS = float(os.environ.get("ZEPPELIN_EXPIRE_DAYS", "14"))
RATE_PER_HOUR = int(os.environ.get("ZEPPELIN_RATE_PER_HOUR", "10"))
SERVER_NAME = os.environ.get("ZEPPELIN_SERVER_NAME", "Zeppelin")
ENDPOINT = os.environ.get("ZEPPELIN_ENDPOINT", "")
SERVER_PUBLIC_KEY = os.environ.get("ZEPPELIN_SERVER_PUBLIC_KEY", "")
DNS = ["1.1.1.1", "1.0.0.1"]
MTU = 1280
KEEPALIVE = 25

KEY_RE = re.compile(r"^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$")
lock = threading.Lock()
rate = {}  # source ip -> [timestamps]
state = {"peers": {}}  # public key -> {"address": "10.67.0.2/32", "created": ts, "seen": ts}


def wg(*args):
    return subprocess.run(["wg", *args], check=True, capture_output=True, text=True).stdout


def save_state():
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.chmod(tmp, 0o600)
    os.replace(tmp, STATE_FILE)


def load_state():
    global state
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            state = json.load(f)
        state.setdefault("peers", {})
    for key, peer in state["peers"].items():
        # Privacy: only the day is kept, never the time of day (also for older records).
        peer["created"] = day(peer.get("created", time.time()))
        peer["seen"] = day(peer.get("seen", time.time()))
        wg("set", WG_IF, "peer", key, "allowed-ips", peer["address"])
    save_state()


def day(ts):
    """Start of the UTC day: records keep the date only."""
    return int(ts) // 86400 * 86400


def next_address():
    used = {p["address"] for p in state["peers"].values()}
    server_ip = POOL.network_address + 1  # the server's own address on wg0
    for host in POOL.hosts():
        if host == server_ip:
            continue
        candidate = f"{host}/32"
        if candidate not in used:
            return candidate
    return None


def allowed_by_rate(source):
    now = time.time()
    recent = [t for t in rate.get(source, []) if now - t < 3600]
    rate[source] = recent
    if len(recent) >= RATE_PER_HOUR:
        return False
    recent.append(now)
    return True


def register(public_key, source):
    if not KEY_RE.match(public_key or ""):
        return 400, {"error": "BAD_KEY"}
    with lock:
        now = day(time.time())
        peer = state["peers"].get(public_key)
        if peer is None:
            if len(state["peers"]) >= MAX_PEERS:
                return 503, {"error": "SERVER_FULL"}
            if not allowed_by_rate(source):
                return 429, {"error": "RATE_LIMITED"}
            address = next_address()
            if address is None:
                return 503, {"error": "SERVER_FULL"}
            peer = {"address": address, "created": now, "seen": now}
            state["peers"][public_key] = peer
        peer["seen"] = now
        wg("set", WG_IF, "peer", public_key, "allowed-ips", peer["address"])
        save_state()
        return 200, {
            "address": peer["address"],
            "serverPublicKey": SERVER_PUBLIC_KEY,
            "endpoint": ENDPOINT,
            "dns": DNS,
            "mtu": MTU,
            "keepalive": KEEPALIVE,
        }


def cleanup_once():
    """Removes peers that neither registered nor handshaked for EXPIRE_DAYS."""
    limit = time.time() - EXPIRE_DAYS * 86400
    handshakes = {}
    try:
        for line in wg("show", WG_IF, "latest-handshakes").splitlines():
            parts = line.split()
            if len(parts) == 2:
                handshakes[parts[0]] = int(parts[1])
    except Exception:
        return
    with lock:
        stale = [k for k, p in state["peers"].items() if p["seen"] < limit and handshakes.get(k, 0) < limit]
        for key in stale:
            try:
                wg("set", WG_IF, "peer", key, "remove")
            except Exception:
                pass
            del state["peers"][key]
        if stale:
            save_state()


def cleanup_loop():
    while True:
        time.sleep(3600)
        cleanup_once()


class Handler(BaseHTTPRequestHandler):
    server_version = "Zeppelin"
    sys_version = ""

    def log_message(self, fmt, *args):  # no request logs: the API keeps no record of who connects
        pass

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/v1/info":
            with lock:
                count = len(state["peers"])
            self.reply(200, {"name": SERVER_NAME, "serverPublicKey": SERVER_PUBLIC_KEY, "endpoint": ENDPOINT,
                             "users": count, "maxUsers": MAX_PEERS})
        else:
            self.reply(404, {"error": "NOT_FOUND"})

    def do_POST(self):
        if self.path != "/v1/register":
            self.reply(404, {"error": "NOT_FOUND"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                self.reply(400, {"error": "BAD_REQUEST"})
                return
            body = json.loads(self.rfile.read(length))
            code, payload = register(str(body.get("publicKey", "")), self.client_address[0])
        except Exception:
            code, payload = 500, {"error": "SERVER_ERROR"}
        self.reply(code, payload)


def main():
    if not SERVER_PUBLIC_KEY or not ENDPOINT:
        print("ZEPPELIN_SERVER_PUBLIC_KEY and ZEPPELIN_ENDPOINT are required", file=sys.stderr)
        sys.exit(2)
    load_state()
    threading.Thread(target=cleanup_loop, daemon=True).start()
    httpd = ThreadingHTTPServer(("0.0.0.0", LISTEN_PORT), Handler)
    httpd.timeout = 10
    print(f"Zeppelin API listening on :{LISTEN_PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
PYEOF
  chmod 700 "$API_DIR/zeppelin-public-api.py"
}

public_on() {
  local name="${1:-Oracle}" country="${2:-}"
  [ -f "$WG_CONF" ] || die "Önce kurulumu yap: sudo bash $0"
  [[ "$name" =~ ^[A-Za-z0-9\ ._-]{1,30}$ ]] || die "Sunucu adı yalnızca harf, rakam, boşluk, nokta, - ve _ içerebilir (en fazla 30)."
  [[ -z "$country" || "$country" =~ ^[A-Za-z]{2}$ ]] || die "Ülke kodu iki harf olmalı (ör. DE)."
  command -v python3 >/dev/null 2>&1 || apt-get -o DPkg::Lock::Timeout=600 install -y python3
  step "Paylaşımlı sunucu açılıyor"
  if ! grep -qF "$PUBLIC_ADDR" "$WG_CONF"; then
    sed -i "s|^Address = $NET4.1/24\$|Address = $NET4.1/24, $PUBLIC_ADDR|" "$WG_CONF"
    grep -qF "$PUBLIC_ADDR" "$WG_CONF" || die "$WG_CONF içinde Address satırı beklenen biçimde değil."
  fi
  ensure_rule nat POSTROUTING -s "$PUBLIC_NET" -o "$IFACE" -m comment --comment "$TAG" -j MASQUERADE
  ensure_rule filter INPUT -p tcp --dport "$API_PORT" -m comment --comment "$TAG" -j ACCEPT
  netfilter-persistent save >/dev/null 2>&1 || die "Kurallar kaydedilemedi."
  write_api
  umask 077
  cat > "$UNIT_DIR/$API_UNIT" <<UNITEOF
[Unit]
Description=Zeppelin VPN shared server registration API
After=wg-quick@$WG_IF.service
PartOf=wg-quick@$WG_IF.service

[Service]
Environment=ZEPPELIN_WG_IF=$WG_IF
Environment=ZEPPELIN_API_PORT=$API_PORT
Environment=ZEPPELIN_PUBLIC_STATE=$WG_DIR/zeppelin-public.json
Environment="ZEPPELIN_SERVER_NAME=$name"
Environment=ZEPPELIN_ENDPOINT=$PUBLIC_IP:$PORT
Environment=ZEPPELIN_SERVER_PUBLIC_KEY=$(cat "$WG_DIR/server.pub")
ExecStart=/usr/bin/python3 $API_DIR/zeppelin-public-api.py
Restart=on-failure
NoNewPrivileges=yes
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=wg-quick@$WG_IF.service
UNITEOF
  printf 'NAME=%q\nCOUNTRY=%q\n' "$name" "$country" > "$WG_DIR/zeppelin-public.env"
  privacy_logs
  systemctl daemon-reload
  systemctl restart "wg-quick@$WG_IF" || die "WireGuard yeniden başlatılamadı."
  systemctl enable --quiet "$API_UNIT" || die "$API_UNIT etkinleştirilemedi."
  systemctl restart "$API_UNIT" || die "$API_UNIT başlatılamadı. Ayrıntı: journalctl -u $API_UNIT"
  ok "Paylaşımlı sunucu açık (TCP $API_PORT kayıt servisi, en fazla 150 cihaz, 14 gün kullanılmayan cihazlar silinir)"
  public_info
}

# Privacy for a shared server: system logs stay in memory only (gone within a day
# and at every reboot), rsyslog stops writing /var/log/syslog and auth.log, and the
# old on-disk logs that may contain users' IP addresses are removed.
privacy_logs() {
  step "Gizlilik: sistem günlükleri yalnızca bellekte"
  mkdir -p "$JOURNALD_DIR"
  cat > "$JOURNALD_DIR/zeppelin-privacy.conf" <<'JOURNALEOF'
# Written by zeppelin-oracle-setup.sh (public-on): logs only in RAM, kept at most 1 day.
[Journal]
Storage=volatile
RuntimeMaxUse=32M
MaxRetentionSec=1day
ForwardToSyslog=no
JOURNALEOF
  systemctl restart systemd-journald >/dev/null 2>&1 || true
  if systemctl is-enabled --quiet rsyslog 2>/dev/null || systemctl is-active --quiet rsyslog 2>/dev/null; then
    systemctl disable --now rsyslog >/dev/null 2>&1 || true
  fi
  rm -rf "${LOG_DIR:?}/journal"
  rm -f "$LOG_DIR"/syslog* "$LOG_DIR"/auth.log* "$LOG_DIR"/kern.log*
  ok "Günlükler artık diske yazılmıyor (en fazla 1 gün bellekte); eski syslog/auth.log kayıtları silindi."
}

public_info() {
  local name country
  [ -f "$WG_DIR/zeppelin-public.env" ] || die "Paylaşımlı sunucu açık değil: sudo bash $0 public-on \"Ad\" DE"
  NAME=""; COUNTRY=""
  # shellcheck disable=SC1091
  . "$WG_DIR/zeppelin-public.env"
  name="${NAME:-Oracle}"; country="${COUNTRY:-}"
  say ""
  say "${C_B}Uygulamaya eklenecek sunucu satırı${C_0} (src/content/servers.ts içindeki listeye yapıştır):"
  say ""
  printf "  { id: '%s', name: '%s', country: '%s', apiUrl: 'http://%s:%s', serverPublicKey: '%s' },\n" \
    "$(printf '%s' "$PUBLIC_IP" | tr '.' '-')" "$name" "$country" "$PUBLIC_IP" "$API_PORT" "$(cat "$WG_DIR/server.pub")"
  say ""
  say "${C_B}Oracle konsolunda:${C_0} Security List'e TCP $API_PORT giriş kuralı ekle (UDP $PORT kuralı zaten olmalı)."
}

public_off() {
  step "Paylaşımlı sunucu kapatılıyor"
  systemctl disable --now --quiet "$API_UNIT" 2>/dev/null || true
  if iptables -C INPUT -p tcp --dport "$API_PORT" -m comment --comment "$TAG" -j ACCEPT 2>/dev/null; then
    iptables -D INPUT -p tcp --dport "$API_PORT" -m comment --comment "$TAG" -j ACCEPT
    netfilter-persistent save >/dev/null 2>&1 || true
  fi
  rm -f "$WG_DIR/zeppelin-public.env"
  systemctl restart "wg-quick@$WG_IF" || true
  ok "Paylaşımlı sunucu kapalı. Kendi profillerin çalışmaya devam eder."
}

status_check() {
  local fails=0 fwd cur
  step "Durum kontrolü"
  if systemctl is-active --quiet "wg-quick@$WG_IF"; then ok "WireGuard servisi çalışıyor"; else bad "WireGuard servisi çalışmıyor -> sudo bash $0 repair"; fails=$((fails + 1)); fi
  if wg show "$WG_IF" >/dev/null 2>&1; then ok "$WG_IF arayüzü açık (port $(wg show "$WG_IF" listen-port 2>/dev/null || echo "?"))"; else bad "$WG_IF arayüzü yok"; fails=$((fails + 1)); fi
  fwd="$(sysctl -n net.ipv4.ip_forward 2>/dev/null || echo 0)"
  if [ "$fwd" = "1" ]; then ok "IP yönlendirme açık"; else bad "IP yönlendirme kapalı -> sudo bash $0 repair"; fails=$((fails + 1)); fi
  if iptables -C INPUT -p udp --dport "$PORT" -m comment --comment "$TAG" -j ACCEPT 2>/dev/null; then ok "UDP $PORT girişi açık (sunucu içinde)"; else bad "UDP $PORT kuralı yok -> sudo bash $0 repair"; fails=$((fails + 1)); fi
  if iptables -C FORWARD -i "$WG_IF" -m comment --comment "$TAG" -j ACCEPT 2>/dev/null; then ok "Yönlendirme (FORWARD) kuralı var"; else bad "FORWARD kuralı yok -> sudo bash $0 repair"; fails=$((fails + 1)); fi
  if iptables -t nat -C POSTROUTING -s "$NET4.0/24" -o "$IFACE" -m comment --comment "$TAG" -j MASQUERADE 2>/dev/null; then ok "NAT ($IFACE) kuralı var"; else bad "NAT kuralı yok -> sudo bash $0 repair"; fails=$((fails + 1)); fi
  cur="$(detect_public_ip 2>/dev/null || true)"
  if [ -n "$cur" ] && [ "$cur" != "$PUBLIC_IP" ]; then
    warn "Sunucunun genel IP'si değişmiş görünüyor: kayıtlı $PUBLIC_IP, şimdiki $cur. Profilleri yeniden oluştur (remove + add)."
  else
    ok "Genel IP: $PUBLIC_IP, port: $PORT"
  fi
  list_clients
  if [ -f "$WG_DIR/zeppelin-public.env" ]; then
    if systemctl is-active --quiet "$API_UNIT"; then ok "Paylaşımlı sunucu açık (TCP $API_PORT)"; else bad "Paylaşımlı sunucu servisi çalışmıyor -> journalctl -u $API_UNIT"; fails=$((fails + 1)); fi
  fi
  say ""
  say "Sunucunun İÇİNDEN kontrol edilemeyen tek şey Oracle'ın bulut güvenlik duvarıdır:"
  say "  Oracle Console -> Networking -> Virtual cloud networks -> (VCN) -> Security Lists -> Default Security List"
  say "  -> Ingress Rules: Source CIDR 0.0.0.0/0, IP Protocol UDP, Destination Port $PORT"
  say "Telefonda 'Sunucudan yanıt yok' görüyorsan önce bunu kontrol et."
  return "$fails"
}

install() {
  check_os
  load_state
  IFACE="${IFACE:-$(detect_iface)}"
  step "Sunucu bilgileri"
  if [ -z "$PUBLIC_IP" ] || [ -n "${ZEPPELIN_PUBLIC_IP:-}" ]; then PUBLIC_IP="$(detect_public_ip)"; fi
  ok "Ağ arayüzü: $IFACE, genel IP: $PUBLIC_IP, UDP port: $PORT"
  install_packages
  enable_forwarding
  server_keys
  write_server_conf
  save_state
  firewall_rules
  start_service
  if ls "$CLIENT_DIR"/*.conf >/dev/null 2>&1; then
    ok "Kurulum zaten yapılmış; mevcut profiller korundu."
    list_clients
    say ""
    say "Yeni cihaz için: sudo bash $0 add tablet   |   Profili tekrar gör: sudo bash $0 show telefon"
  else
    add_client telefon
    print_profile telefon
  fi
  say ""
  say "${C_B}Son adım (Oracle konsolunda):${C_0} Security List'e UDP $PORT giriş kuralı eklediğini kontrol et."
  say "Sağlık kontrolü: sudo bash $0 status"
}

main() {
  local cmd="${1:-install}"
  need_root "$@"
  case "$cmd" in
    install) install ;;
    add)
      [ -n "${2:-}" ] || die "Kullanım: sudo bash $0 add CIHAZ_ADI"
      load_state; [ -f "$WG_CONF" ] || die "Önce kurulumu yap: sudo bash $0"
      add_client "$2"; print_profile "$2" ;;
    show)
      [ -n "${2:-}" ] || die "Kullanım: sudo bash $0 show CIHAZ_ADI"
      load_state; print_profile "$2" ;;
    list) load_state; list_clients ;;
    remove)
      [ -n "${2:-}" ] || die "Kullanım: sudo bash $0 remove CIHAZ_ADI"
      load_state; remove_client "$2" ;;
    status) load_state; status_check ;;
    repair)
      load_state; [ -f "$WG_CONF" ] || die "Önce kurulumu yap: sudo bash $0"
      IFACE="$(detect_iface)"; save_state
      enable_forwarding; firewall_rules; start_service; status_check ;;
    public-on) load_state; public_on "${2:-Oracle}" "${3:-}" ;;
    public-info) load_state; public_info ;;
    public-off) load_state; public_off ;;
    -h|--help|help) sed -n '2,15p' "$0" ;;
    *) die "Bilinmeyen komut: $cmd (yardım: sudo bash $0 help)" ;;
  esac
}

main "$@"
