/**
 * Servers built into the app. They are always shown, even offline, and the downloaded
 * list (servers.json on GitHub) can never replace them: see mergeServers in src/serverList.ts.
 *
 * New servers normally go into servers.json instead (no new APK needed):
 * the server owner runs "sudo bash zeppelin-oracle-setup.sh public-on" and opens the printed
 * proposal link; LenstedReal approves it on GitHub with the "onay" label.
 * See docs/TOPLULUK_TR.md.
 */
import type { ServerEntry } from '../serverList';

export type { ServerEntry };

export const BUILTIN_SERVERS: ServerEntry[] = [
  {
    id: '158-101-173-231',
    name: 'Frankfurt',
    country: 'DE',
    apiUrl: 'http://158.101.173.231:51821',
    serverPublicKey: '5dyfznfuc1D1BUFkDPmeK7THkCPXtdTpGHsRD+eHYgI=',
    operator: 'LenstedReal',
  },
];
