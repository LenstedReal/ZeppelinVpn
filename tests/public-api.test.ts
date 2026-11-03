import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const key = () => randomBytes(32).toString('base64');

/** The API lives inside the setup script (between the PYEOF markers). */
function extractApi(dir: string): string {
  const script = readFileSync(join(root, 'server/zeppelin-oracle-setup.sh'), 'utf8');
  const start = script.indexOf("<<'PYEOF'\n") + "<<'PYEOF'\n".length;
  const end = script.indexOf('\nPYEOF\n', start);
  const file = join(dir, 'api.py');
  writeFileSync(file, script.slice(start, end + 1));
  return file;
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

async function startApi(env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'zapi-'));
  const api = extractApi(dir);
  // fake "wg": records calls, never touches the system
  writeFileSync(join(dir, 'wg'), `#!/bin/sh\necho "$@" >> "${dir}/wg.log"\nexit 0\n`);
  chmodSync(join(dir, 'wg'), 0o755);
  const port = await freePort();
  const serverKey = key();
  const child: ChildProcess = spawn('python3', ['-I', api], {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      ZEPPELIN_API_PORT: String(port),
      ZEPPELIN_PUBLIC_STATE: join(dir, 'state.json'),
      ZEPPELIN_SERVER_PUBLIC_KEY: serverKey,
      ZEPPELIN_ENDPOINT: '129.151.10.20:51820',
      ZEPPELIN_SERVER_NAME: 'Test',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    child.stdout!.on('data', (d) => String(d).includes('listening') && resolve());
    child.on('exit', (c) => reject(new Error(`api exited ${c}`)));
  });
  const base = `http://127.0.0.1:${port}`;
  const post = async (body: unknown) => {
    const res = await fetch(`${base}/v1/register`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  const stop = () => {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  };
  return { base, post, stop, serverKey, dir };
}

test('registration API: addresses, idempotency, validation, limits', async () => {
  const api = await startApi({ ZEPPELIN_MAX_PEERS: '3', ZEPPELIN_RATE_PER_HOUR: '10' });
  try {
    const a = key();
    const first = await api.post({ publicKey: a });
    assert.equal(first.status, 200);
    assert.equal(first.json.address, '10.67.0.2/32');
    assert.equal(first.json.serverPublicKey, api.serverKey);
    assert.equal(first.json.endpoint, '129.151.10.20:51820');
    assert.equal(first.json.mtu, 1280);
    const again = await api.post({ publicKey: a });
    assert.equal(again.json.address, '10.67.0.2/32', 'same device keeps its address');
    assert.equal((await api.post({ publicKey: key() })).json.address, '10.67.0.3/32');
    assert.equal((await api.post({ publicKey: 'not-a-key' })).status, 400);
    assert.equal((await api.post({ publicKey: key() })).status, 200);
    const full = await api.post({ publicKey: key() });
    assert.equal(full.status, 503);
    assert.equal(full.json.error, 'SERVER_FULL');
    const info = (await (await fetch(`${api.base}/v1/info`)).json()) as Record<string, unknown>;
    assert.equal(info.users, 3);
    assert.equal(info.name, 'Test');
    const wgLog = readFileSync(join(api.dir, 'wg.log'), 'utf8');
    assert.ok(wgLog.includes(`set wg0 peer ${a} allowed-ips 10.67.0.2/32`));
    const state = JSON.parse(readFileSync(join(api.dir, 'state.json'), 'utf8'));
    assert.equal(Object.keys(state.peers).length, 3);
    // Privacy: only the day is stored, never the time of day.
    for (const peer of Object.values(state.peers) as Array<{ created: number; seen: number }>) {
      assert.equal(peer.created % 86400, 0);
      assert.equal(peer.seen % 86400, 0);
    }
  } finally {
    api.stop();
  }
});

test('registration API: rate limit per source address', async () => {
  const api = await startApi({ ZEPPELIN_RATE_PER_HOUR: '2' });
  try {
    assert.equal((await api.post({ publicKey: key() })).status, 200);
    assert.equal((await api.post({ publicKey: key() })).status, 200);
    const limited = await api.post({ publicKey: key() });
    assert.equal(limited.status, 429);
    assert.equal(limited.json.error, 'RATE_LIMITED');
  } finally {
    api.stop();
  }
});
