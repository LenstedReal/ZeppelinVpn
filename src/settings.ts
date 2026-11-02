/**
 * App settings: types, defaults, validation and how they turn into
 * WireGuard overrides. No imports except types, so Node tests can load it.
 */
import type { Overrides } from './wireguard/config';

export type Language = 'auto' | 'tr' | 'en';
export type DnsMode = 'profile' | 'cloudflare' | 'quad9' | 'adguard' | 'google' | 'custom';
export type MtuMode = 'profile' | '1280' | '1380' | '1420';
export type KeepaliveMode = 'auto' | '15' | '25' | 'off';

export interface Settings {
  language: Language;
  dnsMode: DnsMode;
  customDns: string;
  mtuMode: MtuMode;
  keepaliveMode: KeepaliveMode;
  /** Keep the tunnel up (traffic blocked) when the server stops answering. */
  killSwitch: boolean;
  /** Retry automatically when a connection attempt fails or the network comes back. */
  autoReconnect: boolean;
  connectOnLaunch: boolean;
  connectOnBoot: boolean;
  /** Ask Cloudflare's trace endpoint for the exit IP, country and latency. */
  exitCheck: boolean;
  alwaysOnTipDismissed: boolean;
  /** The user accepted the in-app VPN disclosure (Google Play VpnService policy). */
  vpnDisclosureAccepted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  dnsMode: 'profile',
  customDns: '',
  mtuMode: 'profile',
  keepaliveMode: 'auto',
  killSwitch: true,
  autoReconnect: true,
  connectOnLaunch: false,
  connectOnBoot: false,
  exitCheck: true,
  alwaysOnTipDismissed: false,
  vpnDisclosureAccepted: false,
};

/** IPv4 resolvers only: profiles from our server script are IPv4-only tunnels. */
export const DNS_PRESETS: Record<'cloudflare' | 'quad9' | 'adguard' | 'google', string[]> = {
  cloudflare: ['1.1.1.1', '1.0.0.1'],
  quad9: ['9.9.9.9', '149.112.112.112'],
  adguard: ['94.140.14.14', '94.140.15.15'],
  google: ['8.8.8.8', '8.8.4.4'],
};

export const DNS_FALLBACK = DNS_PRESETS.cloudflare;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeSettings(raw: unknown): Settings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    language: pick(r.language, ['auto', 'tr', 'en'] as const, d.language),
    dnsMode: pick(r.dnsMode, ['profile', 'cloudflare', 'quad9', 'adguard', 'google', 'custom'] as const, d.dnsMode),
    customDns: typeof r.customDns === 'string' ? r.customDns.slice(0, 200) : d.customDns,
    mtuMode: pick(r.mtuMode, ['profile', '1280', '1380', '1420'] as const, d.mtuMode),
    keepaliveMode: pick(r.keepaliveMode, ['auto', '15', '25', 'off'] as const, d.keepaliveMode),
    killSwitch: bool(r.killSwitch, d.killSwitch),
    autoReconnect: bool(r.autoReconnect, d.autoReconnect),
    connectOnLaunch: bool(r.connectOnLaunch, d.connectOnLaunch),
    connectOnBoot: bool(r.connectOnBoot, d.connectOnBoot),
    exitCheck: bool(r.exitCheck, d.exitCheck),
    alwaysOnTipDismissed: bool(r.alwaysOnTipDismissed, d.alwaysOnTipDismissed),
    vpnDisclosureAccepted: bool(r.vpnDisclosureAccepted, d.vpnDisclosureAccepted),
  };
}

/** Splits "1.1.1.1, 9.9.9.9" (commas or spaces). Returns null if any entry is not an IP. */
export function parseDnsList(text: string, isIp: (s: string) => boolean): string[] | null {
  const items = text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (items.length === 0 || items.length > 4) return null;
  return items.every(isIp) ? items : null;
}

export function resolveOverrides(s: Settings, isIp: (v: string) => boolean): Overrides {
  let dns: string[] | null = null;
  if (s.dnsMode === 'custom') {
    dns = parseDnsList(s.customDns, isIp) ?? DNS_FALLBACK;
  } else if (s.dnsMode !== 'profile') {
    dns = DNS_PRESETS[s.dnsMode];
  }
  const mtu = s.mtuMode === 'profile' ? null : Number(s.mtuMode);
  const keepalive = s.keepaliveMode === 'auto' ? null : s.keepaliveMode === 'off' ? 0 : Number(s.keepaliveMode);
  return { dns, dnsFallback: DNS_FALLBACK, mtu, keepalive, keepaliveFallback: 25 };
}
