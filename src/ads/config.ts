/**
 * InMobi ads (2.4.0). Fill these in from the InMobi publisher dashboard (Inventory → apps → placements).
 * While the account ID is empty the app makes no ad requests at all and shows no ad space.
 * Placement IDs are long numbers; keep them as strings here.
 */
export const INMOBI_ACCOUNT_ID = '';
export const INMOBI_BANNER_PLACEMENT = '';
export const INMOBI_INTERSTITIAL_PLACEMENT = '';

/** At most one full-screen ad per this many minutes, and never in the first minute after opening the app. */
export const INTERSTITIAL_MIN_GAP_MIN = 10;

export const adsConfigured = (): boolean => INMOBI_ACCOUNT_ID.trim().length > 0;

/** Pure rule, tested in tests/ads.test.ts. */
export function interstitialAllowed(now: number, appStartedAt: number, lastShownAt: number, gapMin = INTERSTITIAL_MIN_GAP_MIN): boolean {
  if (now - appStartedAt < 60_000) return false;
  return lastShownAt === 0 || now - lastShownAt >= gapMin * 60_000;
}
