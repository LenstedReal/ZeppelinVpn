import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  checkEntry,
  formatServerList,
  isNonPublicIPv4,
  mergeServers,
  parseServerLine,
  parseServerList,
  type ServerEntry,
} from '../src/serverList.ts';
import { BUILTIN_SERVERS } from '../src/content/servers.ts';

const root = new URL('..', import.meta.url).pathname;
const key = () => randomBytes(32).toString('base64');
const entry = (over: Partial<ServerEntry> = {}): ServerEntry => ({
  id: '9-9-9-9',
  name: 'Amsterdam',
  country: 'NL',
  apiUrl: 'http://9.9.9.9:51821',
  serverPublicKey: key(),
  operator: 'ahmet',
  ...over,
});

test('the list in the repository and the built-in servers are valid', () => {
  const parsed = parseServerList(JSON.parse(readFileSync(join(root, 'servers.json'), 'utf8')));
  assert.ok(parsed);
  assert.equal(parsed.skipped, 0);
  for (const s of BUILTIN_SERVERS) assert.equal(checkEntry(s).ok, true, s.name);
  // the file uses the same layout the bot writes
  assert.equal(readFileSync(join(root, 'servers.json'), 'utf8'), formatServerList(parsed.servers));
});

test('entries are validated strictly', () => {
  assert.equal(checkEntry(entry()).ok, true);
  const lower = checkEntry(entry({ country: 'nl' }));
  assert.ok(lower.ok && lower.entry.country === 'NL');
  const bad: Array<[Partial<ServerEntry>, string]> = [
    [{ id: 'X Y' }, 'BAD_ID'],
    [{ name: '<script>' }, 'BAD_NAME'],
    [{ country: 'NLD' }, 'BAD_COUNTRY'],
    [{ apiUrl: 'ftp://9.9.9.9' }, 'BAD_API_URL'],
    [{ apiUrl: 'http://9.9.9.9:51821/v1/register' }, 'BAD_API_URL'],
    [{ apiUrl: 'http://9.9.9.9:99999' }, 'BAD_API_URL'],
    [{ apiUrl: 'http://192.168.1.10:51821' }, 'PRIVATE_ADDRESS'],
    [{ apiUrl: 'http://127.0.0.1:51821' }, 'PRIVATE_ADDRESS'],
    [{ serverPublicKey: 'abc' }, 'BAD_KEY'],
    [{ operator: '-bad-' }, 'BAD_OPERATOR'],
  ];
  for (const [over, problem] of bad) {
    const res = checkEntry(entry(over));
    assert.equal(res.ok ? 'ok' : res.problem, problem, JSON.stringify(over));
  }
  assert.equal(checkEntry(null).ok, false);
  assert.equal(checkEntry(entry({ apiUrl: 'http://127.0.0.1:51821' }), { allowPrivate: true }).ok, true);
  assert.equal(isNonPublicIPv4('100.64.0.1'), true);
  assert.equal(isNonPublicIPv4('158.101.173.231'), false);
});

test('list parsing skips bad and duplicate entries; built-ins cannot be replaced', () => {
  const a = entry();
  const sameKey = entry({ id: 'other', apiUrl: 'http://8.8.4.4:51821', serverPublicKey: a.serverPublicKey });
  const broken = { ...entry(), serverPublicKey: 'x' };
  const parsed = parseServerList({ version: 1, servers: [a, sameKey, broken] });
  assert.ok(parsed);
  assert.equal(parsed.servers.length, 1);
  assert.equal(parsed.skipped, 2);
  assert.equal(parseServerList({ nope: true }), null);
  assert.equal(parseServerList('x'), null);

  const builtin = BUILTIN_SERVERS[0];
  const hijack = { ...builtin, serverPublicKey: key(), operator: 'evil' };
  const official = entry({ id: 'off', apiUrl: 'http://1.2.3.4:51821', operator: 'LenstedReal', country: 'US' });
  const merged = mergeServers(BUILTIN_SERVERS, [a, hijack, official]);
  assert.deepEqual(merged.map((s) => s.id), [builtin.id, 'off', a.id]);
  assert.equal(merged[0].serverPublicKey, builtin.serverPublicKey);
});

test('finds the server line in an issue body (new JSON and old form)', () => {
  const k = key();
  const json = `### Sunucu satırı\n\n\`\`\`json\n{"id":"1-2-3-4","name":"Amsterdam","country":"NL","apiUrl":"http://1.2.3.4:51821","serverPublicKey":"${k}"}\n\`\`\`\n\n### Not\n\n_No response_`;
  assert.equal(parseServerLine(json)?.serverPublicKey, k);
  const old = `{ id: '1-2-3-4', name: 'Frankfurt 1', country: 'DE', apiUrl: 'http://1.2.3.4:51821', serverPublicKey: '${k}' },`;
  const parsed = parseServerLine(old);
  assert.equal(parsed?.name, 'Frankfurt 1');
  assert.equal(parsed?.serverPublicKey, k);
  assert.equal(parseServerLine('no braces here'), null);
});

const execFileP = promisify(execFile);

async function runBot(dir: string, extra: Record<string, string>): Promise<string> {
  const { stdout } = await execFileP(process.execPath, ['--experimental-strip-types', join(root, 'scripts/community-server.ts')], {
    cwd: dir,
    env: { ...process.env, ZEPPELIN_ROOT: dir, ZEPPELIN_DRY_RUN: '1', ZEPPELIN_ALLOW_PRIVATE: '1', OWNER: 'LenstedReal', ISSUE_NUMBER: '7', ...extra },
  });
  return stdout;
}

test('the bot checks a live server, refuses wrong keys and adds approved servers', async () => {
  const serverKey = key();
  const http = createServer((req, res) => {
    if (req.url === '/v1/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: 'Test', serverPublicKey: serverKey, endpoint: '127.0.0.1:51820' }));
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), 'zvpn-bot-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    cpSync(join(root, 'servers.json'), join(dir, 'servers.json'));
    const line = (k: string) =>
      `{"id":"127-0-0-1","name":"Test City","country":"NL","apiUrl":"http://127.0.0.1:${port}","serverPublicKey":"${k}"}`;
    const before = readFileSync(join(dir, 'servers.json'), 'utf8');
    const countBefore = (JSON.parse(before) as { servers: unknown[] }).servers.length;

    let out = await runBot(dir, { EVENT_ACTION: 'opened', ISSUE_AUTHOR: 'ahmet', ISSUE_BODY: line(serverKey) });
    assert.match(out, /Kontrol tamam/);
    assert.equal(readFileSync(join(dir, 'servers.json'), 'utf8'), before, 'opening must not change the list');

    out = await runBot(dir, { EVENT_ACTION: 'opened', ISSUE_AUTHOR: 'ahmet', ISSUE_BODY: line(key()) });
    assert.match(out, /anahtar/);

    out = await runBot(dir, { EVENT_ACTION: 'labeled', LABEL: 'onay', SENDER: 'someone', ISSUE_AUTHOR: 'ahmet', ISSUE_BODY: line(serverKey) });
    assert.match(out, /Yalnızca @LenstedReal/);
    assert.equal(readFileSync(join(dir, 'servers.json'), 'utf8'), before);

    out = await runBot(dir, { EVENT_ACTION: 'labeled', LABEL: 'sunucu-onerisi', SENDER: 'ahmet', ISSUE_AUTHOR: 'ahmet', ISSUE_BODY: line(serverKey) });
    assert.equal(out, '', 'other labels are ignored');

    out = await runBot(dir, { EVENT_ACTION: 'labeled', LABEL: 'onay', SENDER: 'LenstedReal', ISSUE_AUTHOR: 'ahmet', ISSUE_BODY: line(serverKey) });
    assert.match(out, /Eklendi/);
    // read the raw file: the app itself would skip this 127.0.0.1 test entry
    const raw = JSON.parse(readFileSync(join(dir, 'servers.json'), 'utf8')) as { servers: ServerEntry[] };
    assert.equal(raw.servers.length, countBefore + 1, 'exactly one server is added, whatever the list held before');
    const added = raw.servers.find((s) => s.name === 'Test City');
    assert.equal(added?.operator, 'ahmet', 'operator is the issue author');
    assert.equal(added?.serverPublicKey, serverKey);

    out = await runBot(dir, { EVENT_ACTION: 'labeled', LABEL: 'onay', SENDER: 'LenstedReal', ISSUE_AUTHOR: 'ahmet', ISSUE_BODY: line(serverKey) });
    assert.match(out, /zaten var/);

    writeFileSync(join(dir, 'servers.json'), '{"version":1,"servers":[{"id":"x"}]}');
    await assert.rejects(runBot(dir, { MODE: 'validate' }));
  } finally {
    http.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
