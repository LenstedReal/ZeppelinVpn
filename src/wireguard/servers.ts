/**
 * Turns a shared server's registration answer into a WireGuard config.
 * The device's private key is created on the phone and never sent anywhere;
 * only its public key goes to the server. No imports except types (Node tests load this file).
 */
import type { WgConfig } from './config';

export const SERVER_ID_PREFIX = 'srv:';

export interface RegisterResponse {
  address?: unknown;
  serverPublicKey?: unknown;
  endpoint?: unknown;
  dns?: unknown;
  mtu?: unknown;
  keepalive?: unknown;
  error?: unknown;
}

export type RegisterErrorCode = 'SERVER_FULL' | 'RATE_LIMITED' | 'REGISTER_FAILED' | 'KEY_MISMATCH' | 'BAD_RESPONSE';

export class RegisterError extends Error {
  code: RegisterErrorCode;
  constructor(code: RegisterErrorCode, detail?: string) {
    super(detail ?? code);
    this.code = code;
  }
}

/** Maps the HTTP status / error body of /v1/register to an app error code. */
export function registerErrorFor(status: number, body: RegisterResponse | null): RegisterErrorCode {
  const err = typeof body?.error === 'string' ? body.error : '';
  if (status === 503 || err === 'SERVER_FULL') return 'SERVER_FULL';
  if (status === 429 || err === 'RATE_LIMITED') return 'RATE_LIMITED';
  return 'REGISTER_FAILED';
}

export function buildServerConfig(
  name: string,
  pinnedServerKey: string,
  privateKey: string,
  res: RegisterResponse,
  helpers: { isCidr: (s: string) => boolean; isIP: (s: string) => boolean; isEndpoint: (s: string) => boolean },
): WgConfig {
  if (res.serverPublicKey !== pinnedServerKey) throw new RegisterError('KEY_MISMATCH');
  const address = typeof res.address === 'string' ? res.address : '';
  const endpoint = typeof res.endpoint === 'string' ? res.endpoint : '';
  if (!helpers.isCidr(address) || !helpers.isEndpoint(endpoint)) throw new RegisterError('BAD_RESPONSE');
  const dns = Array.isArray(res.dns) ? res.dns.filter((d): d is string => typeof d === 'string' && helpers.isIP(d)) : [];
  const mtu = typeof res.mtu === 'number' && res.mtu >= 1280 && res.mtu <= 1500 ? res.mtu : 1280;
  const keepalive = typeof res.keepalive === 'number' && res.keepalive > 0 && res.keepalive < 3600 ? res.keepalive : 25;
  return {
    name,
    iface: { privateKey, addresses: [address], dns, mtu, excludedApplications: [], includedApplications: [] },
    peers: [{ publicKey: pinnedServerKey, endpoint, allowedIps: ['0.0.0.0/0', '::/0'], persistentKeepalive: keepalive }],
  };
}
