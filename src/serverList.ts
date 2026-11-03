/**
 * Ready-server list: servers built into the app plus the list in servers.json on GitHub,
 * where approved community servers are added by a GitHub Action (scripts/community-server.ts).
 *
 * Used by the app and by the Action, so the same rules apply on both sides.
 * No imports at all: Node runs this file directly in tests and in the Action.
 */

export const OFFICIAL_OPERATOR = 'LenstedReal';
export const REPO = 'LenstedReal/ZeppelinVpn';
export const SERVER_LIST_URL = `https://raw.githubusercontent.com/${REPO}/main/servers.json`;
/** GitHub issue form for proposing a server (.github/ISSUE_TEMPLATE/sunucu-oner.yml). */
export const PROPOSE_URL = `https://github.com/${REPO}/issues/new?template=sunucu-oner.yml`;
export const MAX_SERVERS = 50;

export interface ServerEntry {
  id: string;
  name: string;
  /** Two-letter country code, shown as a flag. */
  country: string;
  /** Registration API of the server, e.g. http://1.2.3.4:51821 */
  apiUrl: string;
  /** Pinned WireGuard key: the app refuses a server that answers with another key. */
  serverPublicKey: string;
  /** GitHub user who runs the server. OFFICIAL_OPERATOR marks the developer's own servers. */
  operator: string;
}

export type EntryProblem =
  | 'NOT_OBJECT'
  | 'BAD_ID'
  | 'BAD_NAME'
  | 'BAD_COUNTRY'
  | 'BAD_API_URL'
  | 'PRIVATE_ADDRESS'
  | 'BAD_KEY'
  | 'BAD_OPERATOR';

export type CheckResult = { ok: true; entry: ServerEntry } | { ok: false; problem: EntryProblem };

const KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const NAME_RE = /^[\p{L}\p{N} ._-]{1,30}$/u;
const COUNTRY_RE = /^[A-Z]{2}$/;
const OPERATOR_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const URL_RE = /^(http|https):\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?\/?$/;
const HOSTNAME_RE = /^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export function isOfficial(s: ServerEntry): boolean {
  return s.operator === OFFICIAL_OPERATOR;
}

function ipv4Parts(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

/** Loopback, private, link-local, carrier-grade NAT, documentation, multicast and reserved ranges. */
export function isNonPublicIPv4(host: string): boolean {
  const p = ipv4Parts(host);
  if (!p) return false;
  const [a, b, c] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** Host part of an apiUrl (lower case), or null if the URL is not acceptable. */
export function apiHost(apiUrl: string): string | null {
  const m = URL_RE.exec(apiUrl);
  if (!m) return null;
  const host = m[2].toLowerCase();
  const port = m[3] === undefined ? (m[1] === 'https' ? 443 : 80) : Number(m[3]);
  if (port < 1 || port > 65535) return null;
  if (!ipv4Parts(host) && !HOSTNAME_RE.test(host)) return null;
  return host;
}

/**
 * Validates one list entry. Country codes are upper-cased; everything else must already be exact.
 * allowPrivate is only for tests, which run a server on 127.0.0.1.
 */
export function checkEntry(raw: unknown, opts: { allowPrivate?: boolean } = {}): CheckResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, problem: 'NOT_OBJECT' };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const id = str(r.id);
  const name = str(r.name);
  const country = str(r.country).toUpperCase();
  const apiUrl = str(r.apiUrl).replace(/\/$/, '');
  const serverPublicKey = str(r.serverPublicKey);
  const operator = str(r.operator);
  if (!ID_RE.test(id)) return { ok: false, problem: 'BAD_ID' };
  if (!NAME_RE.test(name)) return { ok: false, problem: 'BAD_NAME' };
  if (!COUNTRY_RE.test(country)) return { ok: false, problem: 'BAD_COUNTRY' };
  const host = apiHost(apiUrl);
  if (!host) return { ok: false, problem: 'BAD_API_URL' };
  if (!opts.allowPrivate && (isNonPublicIPv4(host) || host === 'localhost' || host.endsWith('.local'))) {
    return { ok: false, problem: 'PRIVATE_ADDRESS' };
  }
  if (!KEY_RE.test(serverPublicKey)) return { ok: false, problem: 'BAD_KEY' };
  if (!OPERATOR_RE.test(operator)) return { ok: false, problem: 'BAD_OPERATOR' };
  return { ok: true, entry: { id, name, country, apiUrl, serverPublicKey, operator } };
}

/** True if b would clash with a: same id, same key or same API host. */
export function sameServer(a: ServerEntry, b: ServerEntry): boolean {
  return a.id === b.id || a.serverPublicKey === b.serverPublicKey || apiHost(a.apiUrl) === apiHost(b.apiUrl);
}

/**
 * Reads servers.json ({ "version": 1, "servers": [...] }). Invalid or duplicate entries are
 * skipped one by one; null means the file itself is unusable (the app then keeps its last list).
 */
export function parseServerList(
  data: unknown,
  opts: { allowPrivate?: boolean } = {},
): { servers: ServerEntry[]; skipped: number } | null {
  if (!data || typeof data !== 'object') return null;
  const list = (data as { servers?: unknown }).servers;
  if (!Array.isArray(list)) return null;
  const servers: ServerEntry[] = [];
  let skipped = 0;
  for (const raw of list) {
    const res = checkEntry(raw, opts);
    if (!res.ok || servers.some((s) => sameServer(s, res.entry)) || servers.length >= MAX_SERVERS) {
      skipped++;
      continue;
    }
    servers.push(res.entry);
  }
  return { servers, skipped };
}

/**
 * Built-in servers always win: a downloaded entry that clashes with one of them is ignored,
 * so the list on GitHub can add servers but never redirect a built-in one.
 * Order: built-in, other official servers, then community servers by country and name.
 */
export function mergeServers(builtin: ServerEntry[], remote: ServerEntry[]): ServerEntry[] {
  const extra = remote.filter((r) => !builtin.some((b) => sameServer(b, r)));
  const byPlace = (a: ServerEntry, b: ServerEntry) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
  const official = extra.filter(isOfficial).sort(byPlace);
  const community = extra.filter((s) => !isOfficial(s)).sort(byPlace);
  return [...builtin, ...official, ...community];
}

/**
 * Finds the server line in free text (an issue body). Accepts the JSON line printed by
 * "zeppelin-oracle-setup.sh public-info" and the older { id: '...', ... } form.
 */
export function parseServerLine(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = start >= 0 ? text.indexOf('}', start) : -1;
  if (start < 0 || end < 0) return null;
  const chunk = text.slice(start, end + 1);
  const attempts = [
    chunk,
    // older form: unquoted keys and single-quoted values
    chunk.replace(/([{,]\s*)([A-Za-z]+)\s*:/g, '$1"$2":').replace(/'([^'"\\]*)'/g, '"$1"').replace(/,\s*}$/, '}'),
  ];
  for (const candidate of attempts) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      // try the next form
    }
  }
  return null;
}

/** servers.json text with a stable layout (one server per line), for clean diffs. */
export function formatServerList(servers: ServerEntry[]): string {
  const lines = servers.map((s) =>
    '    ' +
    JSON.stringify({
      id: s.id,
      name: s.name,
      country: s.country,
      apiUrl: s.apiUrl,
      serverPublicKey: s.serverPublicKey,
      operator: s.operator,
    }),
  );
  return `{\n  "version": 1,\n  "servers": [\n${lines.join(',\n')}\n  ]\n}\n`;
}
