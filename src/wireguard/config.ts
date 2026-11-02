/**
 * WireGuard .conf parser, validator and serializer.
 *
 * The rules mirror the official WireGuard Android tunnel library
 * (com.wireguard.config.Config.parse), which is what finally validates the
 * text on the device. Checking here first lets the app show a clear,
 * translated error instead of a raw library exception.
 *
 * This file has no imports on purpose: it is used by the app and by the
 * Node test runner (tests/config.test.ts).
 */

export interface WgPeer {
  publicKey: string;
  presharedKey?: string;
  endpoint?: string;
  allowedIps: string[];
  persistentKeepalive?: number;
}

export interface WgInterface {
  privateKey: string;
  addresses: string[];
  dns: string[];
  mtu?: number;
  listenPort?: number;
  excludedApplications: string[];
  includedApplications: string[];
}

export interface WgConfig {
  name?: string;
  iface: WgInterface;
  peers: WgPeer[];
}

export type IssueCode =
  | 'EMPTY'
  | 'SYNTAX'
  | 'UNKNOWN_SECTION'
  | 'NO_INTERFACE'
  | 'MULTIPLE_INTERFACES'
  | 'NO_PEER'
  | 'MISSING_PRIVATE_KEY'
  | 'BAD_PRIVATE_KEY'
  | 'MISSING_ADDRESS'
  | 'BAD_ADDRESS'
  | 'BAD_DNS'
  | 'BAD_MTU'
  | 'BAD_PORT'
  | 'MISSING_PUBLIC_KEY'
  | 'BAD_PUBLIC_KEY'
  | 'BAD_PSK'
  | 'MISSING_ENDPOINT'
  | 'BAD_ENDPOINT'
  | 'MISSING_ALLOWED_IPS'
  | 'BAD_ALLOWED_IPS'
  | 'BAD_KEEPALIVE'
  | 'SERVER_CONFIG'
  // warnings
  | 'DROPPED_KEY'
  | 'UNKNOWN_KEY'
  | 'DUPLICATE_KEY'
  | 'NO_DNS'
  | 'SPLIT_TUNNEL'
  | 'NO_KEEPALIVE'
  | 'MULTI_PEER'
  | 'LOW_MTU';

export interface Issue {
  code: IssueCode;
  line?: number;
  detail?: string;
}

export interface ParseResult {
  config: WgConfig | null;
  errors: Issue[];
  warnings: Issue[];
}

/** wg-quick keys that only make sense on a Linux host; the Android library rejects them. */
const WG_QUICK_ONLY = new Set(['postup', 'postdown', 'preup', 'predown', 'table', 'saveconfig', 'fwmark']);

const KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;

export function isWgKey(value: string): boolean {
  return KEY_RE.test(value.trim());
}

export function isIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(p));
}

export function isIPv6(value: string): boolean {
  if (!/^[0-9a-fA-F:.]+$/.test(value) || !value.includes(':')) return false;
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const left = halves[0] === '' ? [] : halves[0].split(':');
  const right = halves.length === 2 ? (halves[1] === '' ? [] : halves[1].split(':')) : [];
  const groups = left.concat(right);
  let count = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i === groups.length - 1 && g.includes('.')) {
      if (!isIPv4(g)) return false;
      count += 2;
      continue;
    }
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return false;
    count += 1;
  }
  return halves.length === 2 ? count < 8 : count === 8;
}

export function isIP(value: string): boolean {
  return isIPv4(value) || isIPv6(value);
}

const HOST_RE = /^(?=.{1,253}$)[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.?$/;

export function isHostname(value: string): boolean {
  return HOST_RE.test(value) && !/^[0-9.]+$/.test(value);
}

/** "10.0.0.2/32", "fd00::2/128" or a bare address (prefix defaults to full length). */
export function isCidr(value: string): boolean {
  const slash = value.indexOf('/');
  const addr = slash === -1 ? value : value.slice(0, slash);
  const prefix = slash === -1 ? null : value.slice(slash + 1);
  const v4 = isIPv4(addr);
  const v6 = !v4 && isIPv6(addr);
  if (!v4 && !v6) return false;
  if (prefix === null) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const n = Number(prefix);
  return v4 ? n <= 32 : n <= 128;
}

export interface Endpoint {
  host: string;
  port: number;
  isIp: boolean;
}

export function parseEndpoint(value: string): Endpoint | null {
  const v = value.trim();
  let host: string;
  let portText: string;
  if (v.startsWith('[')) {
    const close = v.indexOf(']');
    if (close === -1 || v[close + 1] !== ':') return null;
    host = v.slice(1, close);
    portText = v.slice(close + 2);
    if (!isIPv6(host)) return null;
  } else {
    const colon = v.lastIndexOf(':');
    if (colon <= 0 || v.indexOf(':') !== colon) return null;
    host = v.slice(0, colon);
    portText = v.slice(colon + 1);
    if (!isIPv4(host) && !isHostname(host)) return null;
  }
  if (!/^\d{1,5}$/.test(portText)) return null;
  const port = Number(portText);
  if (port < 1 || port > 65535) return null;
  return { host, port, isIp: isIP(host) };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stripComment(line: string): string {
  const hash = line.indexOf('#');
  return (hash === -1 ? line : line.slice(0, hash)).trim();
}

/** Reads "# Name: Foo" / "# Profile: Foo" comments written by our server script and other tools. */
export function extractName(text: string): string | undefined {
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*[#;]\s*(?:name|profile)\s*[:=]\s*(.+?)\s*$/i.exec(raw);
    if (m && m[1]) return m[1].slice(0, 40);
  }
  return undefined;
}

type Section = 'none' | 'interface' | 'peer' | 'unknown';

export function parseConfig(input: string): ParseResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const text = (input || '').replace(/^﻿/, '');
  if (text.trim().length === 0) {
    return { config: null, errors: [{ code: 'EMPTY' }], warnings };
  }

  const iface: WgInterface = {
    privateKey: '',
    addresses: [],
    dns: [],
    excludedApplications: [],
    includedApplications: [],
  };
  const peers: WgPeer[] = [];
  let interfaceCount = 0;
  let section: Section = 'none';
  let current: WgPeer | null = null;
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = stripComment(lines[i]);
    if (line.length === 0) continue;

    if (line.startsWith('[')) {
      const m = /^\[\s*([A-Za-z]+)\s*\]$/.exec(line);
      const name = m ? m[1].toLowerCase() : '';
      if (name === 'interface') {
        section = 'interface';
        interfaceCount++;
        seen.clear();
      } else if (name === 'peer') {
        section = 'peer';
        current = { publicKey: '', allowedIps: [] };
        peers.push(current);
        seen.clear();
      } else {
        section = 'unknown';
        errors.push({ code: 'UNKNOWN_SECTION', line: lineNo, detail: line });
      }
      continue;
    }

    const eq = line.indexOf('=');
    if (eq <= 0) {
      errors.push({ code: 'SYNTAX', line: lineNo, detail: line });
      continue;
    }
    const keyRaw = line.slice(0, eq).trim();
    const key = keyRaw.toLowerCase();
    const value = line.slice(eq + 1).trim();

    if (section === 'none') {
      errors.push({ code: 'SYNTAX', line: lineNo, detail: line });
      continue;
    }
    if (section === 'unknown') continue;

    if (WG_QUICK_ONLY.has(key)) {
      warnings.push({ code: 'DROPPED_KEY', line: lineNo, detail: keyRaw });
      continue;
    }

    const multi = key === 'address' || key === 'dns' || key === 'allowedips' ||
      key === 'excludedapplications' || key === 'includedapplications';
    if (!multi) {
      if (seen.has(key)) warnings.push({ code: 'DUPLICATE_KEY', line: lineNo, detail: keyRaw });
      seen.add(key);
    }

    if (section === 'interface') {
      switch (key) {
        case 'privatekey':
          if (!isWgKey(value)) errors.push({ code: 'BAD_PRIVATE_KEY', line: lineNo });
          iface.privateKey = value;
          break;
        case 'address':
          for (const a of splitList(value)) {
            if (!isCidr(a)) errors.push({ code: 'BAD_ADDRESS', line: lineNo, detail: a });
            else iface.addresses.push(a);
          }
          break;
        case 'dns':
          for (const d of splitList(value)) {
            if (isIP(d) || isHostname(d)) iface.dns.push(d);
            else errors.push({ code: 'BAD_DNS', line: lineNo, detail: d });
          }
          break;
        case 'mtu': {
          const n = /^\d+$/.test(value) ? Number(value) : NaN;
          if (!(n >= 576 && n <= 9200)) errors.push({ code: 'BAD_MTU', line: lineNo, detail: value });
          else iface.mtu = n;
          break;
        }
        case 'listenport': {
          const n = /^\d+$/.test(value) ? Number(value) : NaN;
          if (!(n >= 0 && n <= 65535)) errors.push({ code: 'BAD_PORT', line: lineNo, detail: value });
          else iface.listenPort = n;
          break;
        }
        case 'excludedapplications':
          iface.excludedApplications.push(...splitList(value));
          break;
        case 'includedapplications':
          iface.includedApplications.push(...splitList(value));
          break;
        default:
          warnings.push({ code: 'UNKNOWN_KEY', line: lineNo, detail: keyRaw });
      }
    } else if (section === 'peer' && current) {
      switch (key) {
        case 'publickey':
          if (!isWgKey(value)) errors.push({ code: 'BAD_PUBLIC_KEY', line: lineNo });
          current.publicKey = value;
          break;
        case 'presharedkey':
          if (!isWgKey(value)) errors.push({ code: 'BAD_PSK', line: lineNo });
          else current.presharedKey = value;
          break;
        case 'endpoint':
          if (!parseEndpoint(value)) errors.push({ code: 'BAD_ENDPOINT', line: lineNo, detail: value });
          else current.endpoint = value;
          break;
        case 'allowedips':
          for (const a of splitList(value)) {
            if (!isCidr(a)) errors.push({ code: 'BAD_ALLOWED_IPS', line: lineNo, detail: a });
            else current.allowedIps.push(a);
          }
          break;
        case 'persistentkeepalive': {
          const v = value.toLowerCase();
          const n = v === 'off' ? 0 : /^\d+$/.test(v) ? Number(v) : NaN;
          if (!(n >= 0 && n <= 65535)) errors.push({ code: 'BAD_KEEPALIVE', line: lineNo, detail: value });
          else current.persistentKeepalive = n;
          break;
        }
        default:
          warnings.push({ code: 'UNKNOWN_KEY', line: lineNo, detail: keyRaw });
      }
    }
  }

  if (interfaceCount === 0) errors.push({ code: 'NO_INTERFACE' });
  if (interfaceCount > 1) errors.push({ code: 'MULTIPLE_INTERFACES' });
  if (interfaceCount > 0) {
    if (!iface.privateKey) errors.push({ code: 'MISSING_PRIVATE_KEY' });
    if (iface.addresses.length === 0 && !errors.some((e) => e.code === 'BAD_ADDRESS')) {
      errors.push({ code: 'MISSING_ADDRESS' });
    }
  }
  if (peers.length === 0) {
    errors.push({ code: 'NO_PEER' });
  } else {
    const withoutEndpoint = peers.filter((p) => !p.endpoint).length;
    // A server config: it listens on a port and none of its peers has an endpoint.
    if (iface.listenPort !== undefined && withoutEndpoint === peers.length && !errors.some((e) => e.code === 'BAD_ENDPOINT')) {
      errors.push({ code: 'SERVER_CONFIG' });
    } else {
      peers.forEach((p, idx) => {
        const peerNo = String(idx + 1);
        if (!p.publicKey) errors.push({ code: 'MISSING_PUBLIC_KEY', detail: peerNo });
        if (!p.endpoint && !errors.some((e) => e.code === 'BAD_ENDPOINT')) {
          errors.push({ code: 'MISSING_ENDPOINT', detail: peerNo });
        }
        if (p.allowedIps.length === 0 && !errors.some((e) => e.code === 'BAD_ALLOWED_IPS')) {
          errors.push({ code: 'MISSING_ALLOWED_IPS', detail: peerNo });
        }
      });
    }
  }

  if (errors.length > 0) return { config: null, errors, warnings };

  const config: WgConfig = { name: extractName(text), iface, peers };
  if (iface.dns.length === 0) warnings.push({ code: 'NO_DNS' });
  if (!isFullTunnel(config)) warnings.push({ code: 'SPLIT_TUNNEL' });
  if (peers.some((p) => !p.persistentKeepalive)) warnings.push({ code: 'NO_KEEPALIVE' });
  if (peers.length > 1) warnings.push({ code: 'MULTI_PEER' });
  if (iface.mtu !== undefined && iface.mtu < 1280 && iface.addresses.some((a) => a.includes(':'))) {
    warnings.push({ code: 'LOW_MTU' });
  }
  return { config, errors, warnings };
}

export function isFullTunnel(cfg: WgConfig): boolean {
  return cfg.peers.some((p) => p.allowedIps.some((a) => a === '0.0.0.0/0'));
}

/** Writes canonical text that com.wireguard.config.Config.parse accepts. */
export function serializeConfig(cfg: WgConfig): string {
  const out: string[] = [];
  if (cfg.name) out.push(`# Name: ${cfg.name.replace(/[\r\n]/g, ' ')}`);
  out.push('[Interface]');
  out.push(`PrivateKey = ${cfg.iface.privateKey}`);
  out.push(`Address = ${cfg.iface.addresses.join(', ')}`);
  if (cfg.iface.dns.length > 0) out.push(`DNS = ${cfg.iface.dns.join(', ')}`);
  if (cfg.iface.mtu !== undefined) out.push(`MTU = ${cfg.iface.mtu}`);
  if (cfg.iface.listenPort !== undefined) out.push(`ListenPort = ${cfg.iface.listenPort}`);
  if (cfg.iface.excludedApplications.length > 0) {
    out.push(`ExcludedApplications = ${cfg.iface.excludedApplications.join(', ')}`);
  }
  if (cfg.iface.includedApplications.length > 0) {
    out.push(`IncludedApplications = ${cfg.iface.includedApplications.join(', ')}`);
  }
  for (const p of cfg.peers) {
    out.push('');
    out.push('[Peer]');
    out.push(`PublicKey = ${p.publicKey}`);
    if (p.presharedKey) out.push(`PresharedKey = ${p.presharedKey}`);
    if (p.endpoint) out.push(`Endpoint = ${p.endpoint}`);
    out.push(`AllowedIPs = ${p.allowedIps.join(', ')}`);
    if (p.persistentKeepalive) out.push(`PersistentKeepalive = ${p.persistentKeepalive}`);
  }
  return out.join('\n') + '\n';
}

export interface Overrides {
  /** null = keep the profile's DNS. */
  dns: string[] | null;
  /** Used only when the profile has no DNS line and dns is null. */
  dnsFallback: string[];
  /** null = keep the profile's MTU. */
  mtu: number | null;
  /** null = keep profile value (or `keepaliveFallback` if it has none); 0 = off. */
  keepalive: number | null;
  keepaliveFallback: number;
}

/** Applies the user's settings to a parsed profile. Returns a new object. */
export function applyOverrides(cfg: WgConfig, o: Overrides): WgConfig {
  const iface: WgInterface = {
    ...cfg.iface,
    addresses: [...cfg.iface.addresses],
    dns: o.dns !== null ? [...o.dns] : cfg.iface.dns.length > 0 ? [...cfg.iface.dns] : [...o.dnsFallback],
    excludedApplications: [...cfg.iface.excludedApplications],
    includedApplications: [...cfg.iface.includedApplications],
  };
  if (o.mtu !== null) iface.mtu = o.mtu;
  const peers = cfg.peers.map((p) => {
    const copy: WgPeer = { ...p, allowedIps: [...p.allowedIps] };
    if (o.keepalive !== null) copy.persistentKeepalive = o.keepalive > 0 ? o.keepalive : undefined;
    else if (!copy.persistentKeepalive && o.keepaliveFallback > 0) copy.persistentKeepalive = o.keepaliveFallback;
    return copy;
  });
  return { name: cfg.name, iface, peers };
}

/** Short, non-secret description of a profile for lists. */
export function describe(cfg: WgConfig): { endpoint: string; host: string; address: string; fullTunnel: boolean } {
  const endpoint = cfg.peers.find((p) => p.endpoint)?.endpoint ?? '';
  const ep = endpoint ? parseEndpoint(endpoint) : null;
  return {
    endpoint,
    host: ep ? ep.host : '',
    address: cfg.iface.addresses.join(', '),
    fullTunnel: isFullTunnel(cfg),
  };
}

/** Replaces key material with dots so a profile can be shown on screen. */
export function maskSecrets(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = /^(\s*(?:PrivateKey|PresharedKey)\s*=\s*)(\S+)/i.exec(line);
      return m ? `${m[1]}${m[2].slice(0, 4)}••••••••••••••••••••` : line;
    })
    .join('\n');
}
