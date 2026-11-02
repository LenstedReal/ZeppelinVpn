import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  applyOverrides,
  describe as describeCfg,
  extractName,
  isCidr,
  isIPv6,
  isWgKey,
  maskSecrets,
  parseConfig,
  parseEndpoint,
  serializeConfig,
} from '../src/wireguard/config.ts';

const key = () => randomBytes(32).toString('base64');
const PRIV = key();
const PUB = key();
const PSK = key();

const CLIENT = `# Name: Oracle-Telefon
# Zeppelin VPN server script
[Interface]
PrivateKey = ${PRIV}
Address = 10.66.66.2/32
DNS = 1.1.1.1, 1.0.0.1
MTU = 1280

[Peer]
PublicKey = ${PUB}
PresharedKey = ${PSK}
Endpoint = 129.151.10.20:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;

test('random keys are valid WireGuard keys', () => {
  for (let i = 0; i < 50; i++) assert.ok(isWgKey(key()));
  assert.equal(isWgKey('abc'), false);
  assert.equal(isWgKey(PRIV.slice(0, 42) + 'B='), false, '43rd char must leave the last 2 bits zero');
});

test('parses a client config from the server script', () => {
  const r = parseConfig(CLIENT);
  assert.deepEqual(r.errors, []);
  assert.ok(r.config);
  const c = r.config!;
  assert.equal(c.name, 'Oracle-Telefon');
  assert.equal(c.iface.privateKey, PRIV);
  assert.deepEqual(c.iface.addresses, ['10.66.66.2/32']);
  assert.deepEqual(c.iface.dns, ['1.1.1.1', '1.0.0.1']);
  assert.equal(c.iface.mtu, 1280);
  assert.equal(c.peers.length, 1);
  assert.equal(c.peers[0].endpoint, '129.151.10.20:51820');
  assert.equal(c.peers[0].presharedKey, PSK);
  assert.deepEqual(c.peers[0].allowedIps, ['0.0.0.0/0', '::/0']);
  assert.equal(c.peers[0].persistentKeepalive, 25);
  assert.deepEqual(r.warnings, []);
  const d = describeCfg(c);
  assert.equal(d.host, '129.151.10.20');
  assert.equal(d.fullTunnel, true);
});

test('handles CRLF, BOM, inline comments and mixed-case keys', () => {
  const text = '﻿' + CLIENT.replace(/\n/g, '\r\n').replace('MTU = 1280', 'mtu=1280 # mobil');
  const r = parseConfig(text);
  assert.deepEqual(r.errors, []);
  assert.equal(r.config!.iface.mtu, 1280);
});

test('drops wg-quick only keys with a warning', () => {
  const r = parseConfig(CLIENT.replace('MTU = 1280', 'MTU = 1280\nPostUp = iptables -A FORWARD -i wg0 -j ACCEPT\nTable = off'));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map((w) => w.code), ['DROPPED_KEY', 'DROPPED_KEY']);
  assert.ok(!serializeConfig(r.config!).includes('PostUp'));
});

test('reports missing and malformed values', () => {
  const codes = (t: string) => parseConfig(t).errors.map((e) => e.code);
  assert.deepEqual(codes(''), ['EMPTY']);
  assert.ok(codes(CLIENT.replace(/PrivateKey = .*\n/, '')).includes('MISSING_PRIVATE_KEY'));
  assert.ok(codes(CLIENT.replace(PRIV, 'not-a-key')).includes('BAD_PRIVATE_KEY'));
  assert.ok(codes(CLIENT.replace('10.66.66.2/32', '10.66.66.300/32')).includes('BAD_ADDRESS'));
  assert.ok(codes(CLIENT.replace(/Endpoint = .*\n/, '')).includes('MISSING_ENDPOINT'));
  assert.ok(codes(CLIENT.replace('129.151.10.20:51820', '2001:db8::1:51820')).includes('BAD_ENDPOINT'));
  assert.ok(codes(CLIENT.replace('[Peer]', '[Pear]')).includes('UNKNOWN_SECTION'));
  assert.ok(codes(CLIENT.replace('MTU = 1280', 'MTU = 99999')).includes('BAD_MTU'));
  assert.ok(codes(CLIENT.replace('AllowedIPs = 0.0.0.0/0, ::/0', 'AllowedIPs = 0.0.0.0/33')).includes('BAD_ALLOWED_IPS'));
  assert.ok(codes('hello world').includes('SYNTAX'));
});

test('recognises a server config pasted by mistake', () => {
  const server = `[Interface]\nAddress = 10.66.66.1/24\nListenPort = 51820\nPrivateKey = ${PRIV}\nPostUp = echo\n\n[Peer]\nPublicKey = ${PUB}\nAllowedIPs = 10.66.66.2/32\n`;
  const r = parseConfig(server);
  assert.deepEqual(r.errors.map((e) => e.code), ['SERVER_CONFIG']);
});

test('endpoint, CIDR and IPv6 helpers', () => {
  assert.deepEqual(parseEndpoint('1.2.3.4:51820'), { host: '1.2.3.4', port: 51820, isIp: true });
  assert.deepEqual(parseEndpoint('vpn.example.com:443'), { host: 'vpn.example.com', port: 443, isIp: false });
  assert.deepEqual(parseEndpoint('[2001:db8::1]:51820'), { host: '2001:db8::1', port: 51820, isIp: true });
  assert.equal(parseEndpoint('1.2.3.4'), null);
  assert.equal(parseEndpoint('1.2.3.4:0'), null);
  assert.equal(parseEndpoint('1.2.3.4:70000'), null);
  assert.equal(parseEndpoint('999.2.3.4:51820'), null);
  assert.ok(isIPv6('::'));
  assert.ok(isIPv6('fd00::1'));
  assert.ok(isIPv6('::ffff:1.2.3.4'));
  assert.ok(isIPv6('2001:0db8:0000:0000:0000:ff00:0042:8329'));
  assert.equal(isIPv6('1:2:3:4:5:6:7:8:9'), false);
  assert.equal(isIPv6('1::2::3'), false);
  assert.equal(isIPv6('12345::'), false);
  assert.ok(isCidr('0.0.0.0/0'));
  assert.ok(isCidr('::/0'));
  assert.ok(isCidr('10.0.0.1'));
  assert.equal(isCidr('10.0.0.1/40'), false);
  assert.equal(isCidr('fd00::/129'), false);
});

test('serialize -> parse round trip keeps every field', () => {
  const first = parseConfig(CLIENT).config!;
  const again = parseConfig(serializeConfig(first));
  assert.deepEqual(again.errors, []);
  assert.deepEqual(again.config, first);
});

test('overrides: DNS preset, fallback, MTU and keepalive', () => {
  const base = parseConfig(CLIENT.replace(/DNS = .*\n/, '').replace('PersistentKeepalive = 25\n', '')).config!;
  const keep = applyOverrides(base, { dns: null, dnsFallback: ['1.1.1.1'], mtu: null, keepalive: null, keepaliveFallback: 25 });
  assert.deepEqual(keep.iface.dns, ['1.1.1.1'], 'empty DNS falls back so lookups never leave the tunnel unanswered');
  assert.equal(keep.peers[0].persistentKeepalive, 25);
  assert.equal(keep.iface.mtu, 1280);

  const forced = applyOverrides(base, { dns: ['9.9.9.9'], dnsFallback: ['1.1.1.1'], mtu: 1380, keepalive: 0, keepaliveFallback: 25 });
  assert.deepEqual(forced.iface.dns, ['9.9.9.9']);
  assert.equal(forced.iface.mtu, 1380);
  assert.equal(forced.peers[0].persistentKeepalive, undefined);
  assert.ok(!serializeConfig(forced).includes('PersistentKeepalive'));
  assert.equal(base.iface.mtu, 1280, 'input is not mutated');
});

test('names and masking', () => {
  assert.equal(extractName('# Profile: Ev\n[Interface]'), 'Ev');
  assert.equal(extractName('[Interface]'), undefined);
  const masked = maskSecrets(CLIENT);
  assert.ok(!masked.includes(PRIV));
  assert.ok(!masked.includes(PSK));
  assert.ok(masked.includes(PUB), 'public keys are not secret');
});
