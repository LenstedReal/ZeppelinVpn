import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interstitialAllowed } from '../src/ads/config.ts';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/settings.ts';

const MIN = 60_000;

test('interstitial: never in the first minute after the app opens', () => {
  assert.equal(interstitialAllowed(30_000, 0, 0), false);
  assert.equal(interstitialAllowed(61_000, 0, 0), true);
});

test('interstitial: at most one per 10 minutes', () => {
  const start = 0;
  const shown = 5 * MIN;
  assert.equal(interstitialAllowed(shown + 9 * MIN, start, shown), false);
  assert.equal(interstitialAllowed(shown + 10 * MIN, start, shown), true);
});

test('personalised ads are off by default and survive sanitizing', () => {
  assert.equal(DEFAULT_SETTINGS.adsPersonalized, false);
  assert.equal(sanitizeSettings({ adsPersonalized: true }).adsPersonalized, true);
  assert.equal(sanitizeSettings({ adsPersonalized: 'yes' }).adsPersonalized, false);
});
