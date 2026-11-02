/**
 * Exit IP / country / latency through the tunnel, from Cloudflare's trace
 * endpoint. Used only while connected and only if the user keeps
 * "Exit IP check" on (Settings). Nothing is stored.
 */
export interface ExitInfo {
  ip: string;
  country: string;
  colo: string;
  latencyMs: number;
}

const TRACE_URL = 'https://1.1.1.1/cdn-cgi/trace';

export function parseTrace(text: string): Omit<ExitInfo, 'latencyMs'> | null {
  const values: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  if (!values.ip) return null;
  return { ip: values.ip, country: values.loc ?? '', colo: values.colo ?? '' };
}

async function fetchTrace(timeoutMs: number): Promise<{ text: string; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${TRACE_URL}?t=${started}`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    const text = await res.text();
    return { text, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Two attempts; the first request of each attempt warms up the TLS connection, the second is timed. */
export async function checkExit(): Promise<ExitInfo | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fetchTrace(7000);
      const timed = await fetchTrace(5000);
      const info = parseTrace(timed.text);
      if (info) return { ...info, latencyMs: timed.ms };
    } catch {
      // try again
    }
  }
  return null;
}
