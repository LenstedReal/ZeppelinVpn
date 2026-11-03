import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { en, hasKey, tr, translate } from '../src/i18n/strings.ts';
import { parseConfig } from '../src/wireguard/config.ts';
import { parseTrace } from '../src/lib/netcheck.ts';
import { INSTALL_COMMAND, SERVER_SCRIPT_GZ_B64, SERVER_SCRIPT_SHA256 } from '../src/generated/serverScript.ts';

const root = new URL('..', import.meta.url).pathname;

test('Turkish and English have the same keys and placeholders', () => {
  const trKeys = Object.keys(tr).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, trKeys);
  for (const key of trKeys) {
    const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
    assert.equal(ph(en[key as keyof typeof en]), ph(tr[key as keyof typeof tr]), `placeholders differ in ${key}`);
  }
  assert.equal(translate('en', 'state.reconnecting.retry', { n: 3 }), 'Attempt 3 in a moment.');
});

test('every parser issue code has a translation', () => {
  const src = readFileSync(join(root, 'src/wireguard/config.ts'), 'utf8');
  const union = src.slice(src.indexOf('export type IssueCode'), src.indexOf('export interface Issue '));
  const codes = [...union.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  assert.ok(codes.length > 20);
  for (const code of codes) assert.ok(hasKey(`issue.${code}`), `missing issue.${code}`);
});

test('every error code produced by the native module has a translation', () => {
  const dir = join(root, 'modules/zeppelin-vpn/android/src/main/java/expo/modules/zeppelinvpn');
  const codes = new Set<string>();
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), 'utf8');
    // Every all-caps string literal in the Kotlin sources is an error code sent to JavaScript.
    for (const m of src.matchAll(/"([A-Z][A-Z_]{2,})"/g)) codes.add(m[1]);
  }
  assert.ok(codes.has('NO_HANDSHAKE') && codes.has('REVOKED'), `codes found: ${[...codes].join(', ')}`);
  for (const code of codes) assert.ok(hasKey(`error.${code}`), `missing error.${code}`);
});

test('Cloudflare trace parsing', () => {
  const info = parseTrace('fl=123\nh=1.1.1.1\nip=129.151.10.20\nts=1\nvisit_scheme=https\ncolo=FRA\nloc=DE\n');
  assert.deepEqual(info, { ip: '129.151.10.20', country: 'DE', colo: 'FRA' });
  assert.equal(parseTrace('<html>blocked</html>'), null);
});

test('embedded install command matches server/zeppelin-oracle-setup.sh', () => {
  const script = readFileSync(join(root, 'server/zeppelin-oracle-setup.sh'));
  assert.equal(createHash('sha256').update(script).digest('hex'), SERVER_SCRIPT_SHA256, 'run: npm run embed-server-script');
  assert.ok(gunzipSync(Buffer.from(SERVER_SCRIPT_GZ_B64, 'base64')).equals(script));
  assert.ok(INSTALL_COMMAND.includes(SERVER_SCRIPT_SHA256));
  assert.ok(INSTALL_COMMAND.endsWith('sudo bash zeppelin-oracle-setup.sh'));
});

test('server script dry run produces a profile the app accepts', () => {
  const out = mkdtempSync(join(tmpdir(), 'zeppelin-'));
  try {
    execFileSync('bash', [join(root, 'tests/server-dry-run.sh')], {
      env: { ...process.env, ZEPPELIN_DRYRUN_OUT: out },
      stdio: 'pipe',
    });
    const phone = parseConfig(readFileSync(join(out, 'laptop.conf'), 'utf8'));
    assert.deepEqual(phone.errors, []);
    assert.deepEqual(phone.warnings, []);
    assert.equal(phone.config!.name, 'Oracle-laptop');
    assert.equal(phone.config!.iface.mtu, 1280);
    assert.equal(phone.config!.peers[0].persistentKeepalive, 25);
    const server = parseConfig(readFileSync(join(out, 'wg0.conf'), 'utf8'));
    assert.deepEqual(server.errors.map((e) => e.code), ['SERVER_CONFIG'], 'pasting the server file gives a clear error');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
