import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, parseDnsList, resolveOverrides, sanitizeSettings } from '../src/settings.ts';
import { isIP } from '../src/wireguard/config.ts';
import { flagEmoji, formatAgo, formatBytes, formatDuration, formatRate } from '../src/lib/format.ts';

test('sanitizeSettings keeps valid values and repairs the rest', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  const s = sanitizeSettings({ language: 'en', dnsMode: 'quad9', mtuMode: '9999', killSwitch: 'yes', exitCheck: false });
  assert.equal(s.language, 'en');
  assert.equal(s.dnsMode, 'quad9');
  assert.equal(s.mtuMode, 'profile');
  assert.equal(s.killSwitch, true);
  assert.equal(s.exitCheck, false);
});

test('resolveOverrides maps settings to WireGuard values', () => {
  const o = resolveOverrides({ ...DEFAULT_SETTINGS }, isIP);
  assert.equal(o.dns, null);
  assert.equal(o.mtu, null);
  assert.equal(o.keepalive, null);
  assert.equal(o.keepaliveFallback, 25);
  const q = resolveOverrides({ ...DEFAULT_SETTINGS, dnsMode: 'adguard', mtuMode: '1380', keepaliveMode: 'off' }, isIP);
  assert.deepEqual(q.dns, ['94.140.14.14', '94.140.15.15']);
  assert.equal(q.mtu, 1380);
  assert.equal(q.keepalive, 0);
  const c = resolveOverrides({ ...DEFAULT_SETTINGS, dnsMode: 'custom', customDns: '9.9.9.9 , 1.1.1.1' }, isIP);
  assert.deepEqual(c.dns, ['9.9.9.9', '1.1.1.1']);
  const bad = resolveOverrides({ ...DEFAULT_SETTINGS, dnsMode: 'custom', customDns: 'dns.google' }, isIP);
  assert.deepEqual(bad.dns, ['1.1.1.1', '1.0.0.1'], 'invalid custom DNS never leaves the tunnel without DNS');
  assert.equal(parseDnsList('', isIP), null);
});

test('formatting', () => {
  assert.equal(formatBytes(0, 'en'), '0 B');
  assert.equal(formatBytes(1536, 'en'), '1.50 KB');
  assert.equal(formatBytes(1536, 'tr'), '1,50 KB');
  assert.equal(formatBytes(5 * 1024 * 1024 * 1024, 'en'), '5.00 GB');
  assert.equal(formatRate(125_000, 'en'), '1.00 Mbps');
  assert.equal(formatRate(1250, 'en'), '10 Kbps');
  assert.equal(formatDuration(3725, 'tr'), '1 sa 02 dk');
  assert.equal(formatDuration(65, 'en'), '1 m 05 s');
  assert.equal(formatAgo(-1, 'tr'), 'hiç');
  assert.equal(formatAgo(30, 'tr'), '30 sn önce');
  assert.equal(flagEmoji('TR'), '\u{1F1F9}\u{1F1F7}');
  assert.equal(flagEmoji('T1'), '');
});
