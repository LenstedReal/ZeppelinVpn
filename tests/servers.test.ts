import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { isCidr, isIP, parseConfig, parseEndpoint, serializeConfig } from '../src/wireguard/config.ts';
import { buildServerConfig, registerErrorFor, RegisterError } from '../src/wireguard/servers.ts';

const key = () => randomBytes(32).toString('base64');
const helpers = { isCidr, isIP, isEndpoint: (s: string) => parseEndpoint(s) !== null };

test('builds a valid full-tunnel config from a registration answer', () => {
  const server = key();
  const priv = key();
  const cfg = buildServerConfig('Frankfurt', server, priv, {
    address: '10.67.0.2/32', serverPublicKey: server, endpoint: '129.151.10.20:51820', dns: ['1.1.1.1', 'x'], mtu: 1280, keepalive: 25,
  }, helpers);
  const round = parseConfig(serializeConfig(cfg));
  assert.deepEqual(round.errors, []);
  assert.deepEqual(round.warnings, []);
  assert.equal(round.config!.iface.privateKey, priv);
  assert.deepEqual(round.config!.iface.dns, ['1.1.1.1']);
  assert.equal(round.config!.peers[0].publicKey, server);
});

test('refuses a server that answers with another key or a broken answer', () => {
  const server = key();
  assert.throws(
    () => buildServerConfig('x', server, key(), { address: '10.67.0.2/32', serverPublicKey: key(), endpoint: '1.2.3.4:51820' }, helpers),
    (e: unknown) => e instanceof RegisterError && e.code === 'KEY_MISMATCH',
  );
  assert.throws(
    () => buildServerConfig('x', server, key(), { address: 'nope', serverPublicKey: server, endpoint: '1.2.3.4:51820' }, helpers),
    (e: unknown) => e instanceof RegisterError && e.code === 'BAD_RESPONSE',
  );
});

test('maps registration errors', () => {
  assert.equal(registerErrorFor(503, { error: 'SERVER_FULL' }), 'SERVER_FULL');
  assert.equal(registerErrorFor(429, null), 'RATE_LIMITED');
  assert.equal(registerErrorFor(500, null), 'REGISTER_FAILED');
});
