/**
 * Ready-to-use shared servers shown in the app ("Hazır sunucular").
 *
 * After "sudo bash zeppelin-oracle-setup.sh public-on" on a server, run
 * "sudo bash zeppelin-oracle-setup.sh public-info" and paste the printed line
 * into this list, then push: GitHub Actions builds the new APK.
 * The WireGuard public key is pinned here, so the app refuses a server that
 * answers with a different key.
 */
export interface ServerEntry {
  id: string;
  name: string;
  /** Two-letter country code, shown as a flag. */
  country: string;
  /** Registration API of the server, e.g. http://1.2.3.4:51821 */
  apiUrl: string;
  serverPublicKey: string;
}

export const BUILTIN_SERVERS: ServerEntry[] = [
  // { id: '129-151-10-20', name: 'Frankfurt', country: 'DE', apiUrl: 'http://129.151.10.20:51821', serverPublicKey: '...' },
];
