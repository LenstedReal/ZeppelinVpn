import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interstitialAllowed } from '../src/ads/config.ts';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/settings.ts';

const MIN = 60_000;

test('interstitial: first connect always allowed, then at most one per 3 minutes', () => {
  assert.equal(interstitialAllowed(1_000, 0), true);
  const shown = 5 * MIN;
  assert.equal(interstitialAllowed(shown + 2 * MIN, shown), false);
  assert.equal(interstitialAllowed(shown + 3 * MIN, shown), true);
});

test('personalised ads are off by default and survive sanitizing', () => {
  assert.equal(DEFAULT_SETTINGS.adsPersonalized, false);
  assert.equal(sanitizeSettings({ adsPersonalized: true }).adsPersonalized, true);
  assert.equal(sanitizeSettings({ adsPersonalized: 'yes' }).adsPersonalized, false);
});
