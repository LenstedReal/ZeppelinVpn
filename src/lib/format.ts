/** Number and time formatting for the status screen. Pure functions, no imports. */

export type Lang = 'tr' | 'en';

export function formatBytes(bytes: number, lang: Lang): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const digits = u === 0 ? 0 : v < 10 ? 2 : v < 100 ? 1 : 0;
  return `${localeNumber(v, digits, lang)} ${units[u]}`;
}

/** Bytes per second -> bits per second, the unit people know from speed tests. */
export function formatRate(bytesPerSecond: number, lang: Lang): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 0) return '—';
  const bits = bytesPerSecond * 8;
  if (bits < 1000) return `${localeNumber(bits, 0, lang)} bps`;
  if (bits < 1_000_000) return `${localeNumber(bits / 1000, bits < 10_000 ? 1 : 0, lang)} Kbps`;
  return `${localeNumber(bits / 1_000_000, bits < 10_000_000 ? 2 : 1, lang)} Mbps`;
}

export function formatDuration(totalSeconds: number, lang: Lang): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const L = lang === 'tr' ? { h: 'sa', m: 'dk', s: 'sn' } : { h: 'h', m: 'm', s: 's' };
  if (h > 0) return `${h} ${L.h} ${String(m).padStart(2, '0')} ${L.m}`;
  if (m > 0) return `${m} ${L.m} ${String(sec).padStart(2, '0')} ${L.s}`;
  return `${sec} ${L.s}`;
}

export function formatAgo(seconds: number, lang: Lang): string {
  if (seconds < 0) return lang === 'tr' ? 'hiç' : 'never';
  if (seconds < 2) return lang === 'tr' ? 'az önce' : 'just now';
  return lang === 'tr' ? `${formatDuration(seconds, lang)} önce` : `${formatDuration(seconds, lang)} ago`;
}

function localeNumber(v: number, digits: number, lang: Lang): string {
  const fixed = v.toFixed(digits);
  return lang === 'tr' ? fixed.replace('.', ',') : fixed;
}

/** Turns a two-letter country code into its flag emoji ("TR" -> 🇹🇷). */
export function flagEmoji(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return '';
  const base = 0x1f1e6;
  const up = cc.toUpperCase();
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65);
}
