/**
 * InMobi ads (2.4.0). Fill these in from the InMobi publisher dashboard (Inventory → apps → placements).
 * While the account ID is empty the app makes no ad requests at all and shows no ad space.
 * Placement IDs are long numbers; keep them as strings here.
 */
export const INMOBI_ACCOUNT_ID = '';
export const INMOBI_BANNER_PLACEMENT = '';
export const INMOBI_INTERSTITIAL_PLACEMENT = '';

/** Full-screen ad before connecting: at most one per this many minutes (a quick reconnect is not interrupted). */
export const INTERSTITIAL_MIN_GAP_MIN = 3;

/** If the ad never reports that it closed, connect anyway after this long. */
export const INTERSTITIAL_MAX_WAIT_MS = 90_000;

export const adsConfigured = (): boolean => INMOBI_ACCOUNT_ID.trim().length > 0;

/** Pure rule, tested in tests/ads.test.ts. */
export function interstitialAllowed(now: number, lastShownAt: number, gapMin = INTERSTITIAL_MIN_GAP_MIN): boolean {
  return lastShownAt === 0 || now - lastShownAt >= gapMin * 60_000;
}
