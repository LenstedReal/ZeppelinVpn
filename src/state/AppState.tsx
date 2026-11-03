import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState as RNAppState } from 'react-native';
import ZeppelinVpn, { EMPTY_STATUS, normalizeStatus, type TunnelStatus } from '../../modules/zeppelin-vpn';
import { DEFAULT_SETTINGS, resolveOverrides, sanitizeSettings, type Settings } from '../settings';
import { applyOverrides, isCidr, isIP, parseConfig, parseEndpoint, serializeConfig, type Issue, type WgConfig } from '../wireguard/config';
import { buildServerConfig, registerErrorFor, RegisterError, SERVER_ID_PREFIX, type RegisterResponse } from '../wireguard/servers';
import { BUILTIN_SERVERS } from '../content/servers';
import { isOfficial, mergeServers, parseServerList, SERVER_LIST_URL, type ServerEntry } from '../serverList';
import { hasKey, translate, type Lang, type StringKey } from '../i18n/strings';
import { checkExit, type ExitInfo } from '../lib/netcheck';

export interface Profile {
  id: string;
  name: string;
  conf: string;
  createdAt: number;
  updatedAt: number;
}

interface VaultData {
  v: 1;
  selectedId: string | null;
  profiles: Profile[];
}

export type ExitState = 'idle' | 'checking' | 'ok' | 'fail' | 'off';

export interface ServerListInfo {
  /** idle: not downloaded in this session (a saved list may be in use). */
  state: 'idle' | 'loading' | 'ok' | 'fail';
  /** When the list in use was downloaded (epoch ms), 0 if never. */
  fetchedAt: number;
}

export interface Rates {
  down: number;
  up: number;
}

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

interface ConnectOptions {
  /** The VPN disclosure was just accepted (the saved setting may not be updated yet). */
  disclosureAccepted?: boolean;
  /** The user just accepted the community server warning. */
  communityAccepted?: boolean;
}

interface AppStateValue {
  ready: boolean;
  nativeAvailable: boolean;
  lang: Lang;
  t: Translate;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  profiles: Profile[];
  selectedId: string | null;
  selectedProfile: Profile | null;
  /** Shared server chosen instead of an own profile (ids start with "srv:"). */
  selectedServer: ServerEntry | null;
  /** Built-in servers plus the downloaded list (official first, then community). */
  servers: ServerEntry[];
  serverList: ServerListInfo;
  refreshServerList: () => void;
  selectProfile: (id: string) => Promise<void>;
  saveProfile: (input: { id?: string; name: string; conf: string }) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
  vaultError: boolean;
  status: TunnelStatus;
  rates: Rates;
  exit: ExitInfo | null;
  exitState: ExitState;
  refreshExit: () => void;
  busy: boolean;
  connect: (opts?: ConnectOptions) => Promise<void>;
  disclosureOpen: boolean;
  acceptDisclosure: () => void;
  declineDisclosure: () => void;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  errorText: string | null;
  clearError: () => void;
  toast: string | null;
  showToast: (message: string) => void;
  issueText: (issue: Issue) => string;
  errorMessage: (code: string | null, detail?: string | null) => string;
  resetAll: () => Promise<void>;
  appVersion: string;
  /** Android allows this app's notifications (permission granted and not blocked). */
  notificationsAllowed: boolean;
  /** Asks for the notification permission, or opens the notification settings when Android will not ask. */
  requestNotifications: () => void;
}

const Ctx = createContext<AppStateValue | null>(null);

const VAULT_PROFILES = 'profiles';
const VAULT_DEVICE_KEYS = 'device_keys';
const VAULT_SERVER_LIST = 'server_list';
const REGISTER_TIMEOUT_MS = 10_000;
const LIST_TIMEOUT_MS = 8_000;
/** Downloaded again when the app comes to the foreground and the list is older than this. */
const LIST_MAX_AGE_MS = 30 * 60_000;

const serverId = (s: ServerEntry) => SERVER_ID_PREFIX + s.id;

function defaultSelection(profiles: Profile[]): string | null {
  return profiles[0]?.id ?? (BUILTIN_SERVERS[0] ? serverId(BUILTIN_SERVERS[0]) : null);
}

function isValidSelection(id: unknown, profiles: Profile[], servers: ServerEntry[]): id is string {
  return typeof id === 'string' && (profiles.some((p) => p.id === id) || servers.some((s) => serverId(s) === id));
}
const EXIT_INTERVAL_MS = 60_000;

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function readVault(raw: string | null, servers: ServerEntry[]): VaultData {
  if (!raw) return { v: 1, selectedId: defaultSelection([]), profiles: [] };
  const data = JSON.parse(raw) as Partial<VaultData>;
  const profiles = Array.isArray(data.profiles)
    ? data.profiles.filter(
        (p): p is Profile => !!p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.conf === 'string',
      )
    : [];
  const selectedId = isValidSelection(data.selectedId, profiles, servers) ? data.selectedId : defaultSelection(profiles);
  return { v: 1, selectedId, profiles };
}

function deviceLanguage(): Lang {
  try {
    const native = ZeppelinVpn?.deviceLanguage();
    const code = native || Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    return code.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

function loadSettings(): Settings {
  try {
    const raw = ZeppelinVpn?.loadSettings();
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const native = ZeppelinVpn;
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [vault, setVault] = useState<VaultData>({ v: 1, selectedId: defaultSelection([]), profiles: [] });
  const [vaultError, setVaultError] = useState(false);
  const [status, setStatus] = useState<TunnelStatus>(() => normalizeStatus(native?.getStatus()));
  const [rates, setRates] = useState<Rates>({ down: 0, up: 0 });
  const [exit, setExit] = useState<ExitInfo | null>(null);
  const [exitState, setExitState] = useState<ExitState>('idle');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [notificationsAllowed, setNotificationsAllowed] = useState(() => {
    try {
      return native?.notificationsAllowed() ?? false;
    } catch {
      return false;
    }
  });
  const [remoteServers, setRemoteServers] = useState<ServerEntry[]>([]);
  const [serverList, setServerList] = useState<ServerListInfo>({ state: 'idle', fetchedAt: 0 });
  const servers = useMemo(() => mergeServers(BUILTIN_SERVERS, remoteServers), [remoteServers]);
  const serversRef = useRef(servers);
  serversRef.current = servers;
  const listFetchedAt = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSample = useRef<{ rx: number; tx: number; at: number } | null>(null);
  const autoConnectDone = useRef(false);
  const vaultRef = useRef(vault);
  vaultRef.current = vault;

  const systemLang = useMemo(deviceLanguage, []);
  const lang: Lang = settings.language === 'auto' ? systemLang : settings.language;
  const t = useCallback<Translate>((key, params) => translate(lang, key, params), [lang]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const errorMessage = useCallback(
    (code: string | null, detail?: string | null) => {
      const key = `error.${code ?? 'UNKNOWN'}`;
      if (hasKey(key)) return translate(lang, key, { detail: detail ?? '' });
      return translate(lang, 'error.UNKNOWN', { detail: [code, detail].filter(Boolean).join(': ') });
    },
    [lang],
  );

  const issueText = useCallback(
    (issue: Issue) => {
      const key = `issue.${issue.code}`;
      const text = hasKey(key) ? translate(lang, key, { detail: issue.detail ?? '' }) : issue.code;
      return issue.line ? `${text} (${translate(lang, 'editor.line', { n: issue.line })})` : text;
    },
    [lang],
  );

  // ---- initial load + native events
  const appActiveRef = useRef(true);
  useEffect(() => {
    let cancelled = false;
    const sub = native?.addListener('onStatus', (s: TunnelStatus) => {
      const next = normalizeStatus(s);
      // In the background only state changes matter; skip the 2-second counter updates.
      setStatus((prev) =>
        !appActiveRef.current && prev.state === next.state && prev.tunnelUp === next.tunnelUp && prev.error === next.error
          ? prev
          : next,
      );
    });
    (async () => {
      if (native) {
        // The last downloaded server list first, so a selected community server stays selected.
        let cached: ServerEntry[] = [];
        try {
          const raw = await native.vaultLoad(VAULT_SERVER_LIST);
          const saved = raw ? (JSON.parse(raw) as { fetchedAt?: unknown; data?: unknown }) : null;
          const parsed = saved ? parseServerList(saved.data) : null;
          if (saved && parsed) {
            cached = parsed.servers;
            listFetchedAt.current = typeof saved.fetchedAt === 'number' ? saved.fetchedAt : 0;
            if (!cancelled) {
              setRemoteServers(cached);
              setServerList({ state: 'idle', fetchedAt: listFetchedAt.current });
            }
          }
        } catch {
          // no saved list: the built-in servers are shown until the download finishes
        }
        try {
          const data = readVault(await native.vaultLoad(VAULT_PROFILES), mergeServers(BUILTIN_SERVERS, cached));
          if (!cancelled) setVault(data);
        } catch {
          if (!cancelled) setVaultError(true);
        }
        if (!cancelled) setStatus(normalizeStatus(native.getStatus()));
      }
      if (!cancelled) setReady(true);
    })();
    const appSub = RNAppState.addEventListener('change', (s) => {
      const isActive = s === 'active';
      appActiveRef.current = isActive;
      setAppActive(isActive);
      if (isActive && native) {
        prevSample.current = null;
        setStatus(normalizeStatus(native.getStatus()));
        // The permission dialog and the settings page both return here.
        try {
          setNotificationsAllowed(native.notificationsAllowed());
        } catch {
          // keep the last value
        }
      }
    });
    return () => {
      cancelled = true;
      sub?.remove();
      appSub.remove();
    };
  }, [native]);

  // ---- speeds from byte counters
  useEffect(() => {
    if (!status.tunnelUp) {
      prevSample.current = null;
      setRates({ down: 0, up: 0 });
      return;
    }
    const prev = prevSample.current;
    const at = status.updatedAt || Date.now();
    if (prev && at > prev.at && status.rxBytes >= prev.rx && status.txBytes >= prev.tx) {
      const seconds = (at - prev.at) / 1000;
      setRates({ down: (status.rxBytes - prev.rx) / seconds, up: (status.txBytes - prev.tx) / seconds });
    }
    prevSample.current = { rx: status.rxBytes, tx: status.txBytes, at };
  }, [status.tunnelUp, status.rxBytes, status.txBytes, status.updatedAt]);

  // ---- exit IP / internet reachability through the tunnel
  const exitRunning = useRef(false);
  const runExitCheck = useCallback(async () => {
    if (!settings.exitCheck) {
      setExitState('off');
      return;
    }
    if (exitRunning.current) return;
    exitRunning.current = true;
    setExitState('checking');
    try {
      const info = await checkExit();
      if (info) {
        setExit(info);
        setExitState('ok');
      } else {
        setExitState('fail');
      }
    } finally {
      exitRunning.current = false;
    }
  }, [settings.exitCheck]);

  const connected = status.state === 'connected';
  useEffect(() => {
    if (!connected) {
      // While reconnecting the last result would be stale; show it again only after a new check.
      setExitState(settings.exitCheck ? 'idle' : 'off');
      if (!status.tunnelUp) setExit(null);
      return;
    }
    if (!appActive) return;
    runExitCheck();
    const timer = setInterval(runExitCheck, EXIT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [connected, appActive, runExitCheck, status.tunnelUp, settings.exitCheck]);

  // ---- persistence helpers
  const persistVault = useCallback(
    async (next: VaultData) => {
      setVault(next);
      if (native) await native.vaultSave(VAULT_PROFILES, JSON.stringify(next));
    },
    [native],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = sanitizeSettings({ ...prev, ...patch });
        try {
          native?.saveSettings(JSON.stringify(next));
        } catch {
          // stays in memory for this session
        }
        return next;
      });
    },
    [native],
  );

  const selectProfile = useCallback(
    async (id: string) => {
      await persistVault({ ...vaultRef.current, selectedId: id });
    },
    [persistVault],
  );

  const saveProfile = useCallback(
    async (input: { id?: string; name: string; conf: string }) => {
      const now = Date.now();
      const current = vaultRef.current;
      const existing = input.id ? current.profiles.find((p) => p.id === input.id) : undefined;
      const profile: Profile = existing
        ? { ...existing, name: input.name, conf: input.conf, updatedAt: now }
        : { id: newId(), name: input.name, conf: input.conf, createdAt: now, updatedAt: now };
      const profiles = existing
        ? current.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...current.profiles, profile];
      await persistVault({ v: 1, profiles, selectedId: current.selectedId ?? profile.id });
      return profile;
    },
    [persistVault],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      const current = vaultRef.current;
      const profiles = current.profiles.filter((p) => p.id !== id);
      const selectedId = current.selectedId === id ? defaultSelection(profiles) : current.selectedId;
      await persistVault({ v: 1, profiles, selectedId });
    },
    [persistVault],
  );

  const selectedProfile = vault.profiles.find((p) => p.id === vault.selectedId) ?? null;
  const selectedServer = servers.find((s) => serverId(s) === vault.selectedId) ?? null;

  // ---- ready-server list from GitHub (servers.json)
  const listRunning = useRef(false);
  const refreshServerList = useCallback(async () => {
    if (!settings.serverListUpdate || listRunning.current) return;
    listRunning.current = true;
    setServerList((prev) => ({ ...prev, state: 'loading' }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIST_TIMEOUT_MS);
    try {
      const res = await fetch(SERVER_LIST_URL, { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseServerList(await res.json());
      if (!parsed) throw new Error('unusable list');
      const fetchedAt = Date.now();
      listFetchedAt.current = fetchedAt;
      setRemoteServers(parsed.servers);
      setServerList({ state: 'ok', fetchedAt });
      if (native) {
        try {
          await native.vaultSave(VAULT_SERVER_LIST, JSON.stringify({ fetchedAt, data: { version: 1, servers: parsed.servers } }));
        } catch {
          // still used for this session
        }
      }
    } catch {
      // offline, GitHub unreachable or a broken file: keep the list we have
      setServerList((prev) => ({ ...prev, state: 'fail' }));
    } finally {
      clearTimeout(timer);
      listRunning.current = false;
    }
  }, [native, settings.serverListUpdate]);

  useEffect(() => {
    if (!ready || !appActive || Date.now() - listFetchedAt.current < LIST_MAX_AGE_MS) return;
    refreshServerList();
  }, [ready, appActive, refreshServerList]);

  // A server removed from the list cannot stay selected.
  useEffect(() => {
    if (!ready) return;
    const sel = vaultRef.current.selectedId;
    if (sel && sel.startsWith(SERVER_ID_PREFIX) && !servers.some((s) => serverId(s) === sel)) {
      persistVault({ ...vaultRef.current, selectedId: defaultSelection(vaultRef.current.profiles) }).catch(() => undefined);
    }
  }, [ready, servers, persistVault]);

  /** Registers this phone on a shared server and returns its WireGuard config. */
  const serverConfig = useCallback(
    async (server: ServerEntry): Promise<WgConfig> => {
      if (!native) throw new RegisterError('REGISTER_FAILED');
      let keys: Record<string, { privateKey: string; publicKey: string }> = {};
      try {
        const raw = await native.vaultLoad(VAULT_DEVICE_KEYS);
        if (raw) keys = JSON.parse(raw);
      } catch {
        keys = {};
      }
      let pair = keys[server.id];
      if (!pair) {
        pair = native.generateKeyPair();
        keys[server.id] = pair;
        await native.vaultSave(VAULT_DEVICE_KEYS, JSON.stringify(keys));
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${server.apiUrl}/v1/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: pair.publicKey }),
          signal: controller.signal,
        });
      } catch {
        throw new RegisterError('REGISTER_FAILED');
      } finally {
        clearTimeout(timer);
      }
      let body: RegisterResponse | null = null;
      try {
        body = (await res.json()) as RegisterResponse;
      } catch {
        body = null;
      }
      if (!res.ok || !body) throw new RegisterError(registerErrorFor(res.status, body));
      return buildServerConfig(server.name, server.serverPublicKey, pair.privateKey, body, {
        isCidr,
        isIP,
        isEndpoint: (v) => parseEndpoint(v) !== null,
      });
    },
    [native],
  );

  // ---- tunnel control
  const connectRef = useRef<(opts?: ConnectOptions) => Promise<void>>(async () => undefined);
  const connect = useCallback(async (opts?: ConnectOptions) => {
    setErrorText(null);
    if (!native) {
      setErrorText(translate(lang, 'home.noNative'));
      return;
    }
    // Google Play VpnService policy: explain the VPN in the app before Android's own permission dialog.
    if (!settings.vpnDisclosureAccepted && !opts?.disclosureAccepted) {
      setDisclosureOpen(true);
      return;
    }
    const selected = vaultRef.current.selectedId;
    const server = serversRef.current.find((s) => serverId(s) === selected);
    const profile = vaultRef.current.profiles.find((p) => p.id === selected);
    if (!selected || (!server && !profile)) {
      setErrorText(errorMessage('NO_SELECTION'));
      return;
    }
    // Community servers: say once who runs the server before the first connection to it.
    if (server && !isOfficial(server) && !opts?.communityAccepted && !settings.trustedServers.includes(server.id)) {
      Alert.alert(
        translate(lang, 'community.title'),
        translate(lang, 'community.body', { name: server.name, operator: server.operator }),
        [
          { text: translate(lang, 'common.cancel'), style: 'cancel' },
          {
            text: translate(lang, 'community.accept'),
            onPress: () => {
              updateSettings({ trustedServers: [...settings.trustedServers, server.id] });
              connectRef.current({ ...opts, communityAccepted: true });
            },
          },
        ],
      );
      return;
    }
    let base: WgConfig | null = null;
    if (profile) {
      const parsed = parseConfig(profile.conf);
      if (!parsed.config) {
        setErrorText(errorMessage('BAD_CONFIG', parsed.errors.map(issueText).join(' ')));
        return;
      }
      base = parsed.config;
    }
    setBusy(true);
    try {
      if (server) base = await serverConfig(server);
      const effective = serializeConfig(applyOverrides(base as WgConfig, resolveOverrides(settings, isIP)));
      const allowed = await native.prepare();
      if (!allowed) {
        setErrorText(errorMessage('NO_PERMISSION'));
        return;
      }
      await native.connect(effective, selected, server ? server.name : (profile as Profile).name);
    } catch (e) {
      if (e instanceof RegisterError) {
        setErrorText(errorMessage(e.code));
        return;
      }
      const err = e as { code?: string; message?: string };
      const now = normalizeStatus(native.getStatus());
      // While the native side retries on its own, the status card already explains it.
      if (now.state !== 'reconnecting') setErrorText(errorMessage(err.code ?? 'UNKNOWN', err.message ?? ''));
    } finally {
      setBusy(false);
    }
  }, [native, lang, settings, errorMessage, issueText, serverConfig, updateSettings]);
  connectRef.current = connect;

  const acceptDisclosure = useCallback(() => {
    setDisclosureOpen(false);
    updateSettings({ vpnDisclosureAccepted: true });
    connect({ disclosureAccepted: true });
  }, [connect, updateSettings]);

  const declineDisclosure = useCallback(() => {
    setDisclosureOpen(false);
    showToast(translate(lang, 'disclosure.declined'));
  }, [lang, showToast]);

  const disconnect = useCallback(async () => {
    setErrorText(null);
    if (!native) return;
    setBusy(true);
    try {
      await native.disconnect();
    } finally {
      setBusy(false);
    }
  }, [native]);

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  // ---- "connect when the app opens"
  useEffect(() => {
    if (!ready || autoConnectDone.current) return;
    autoConnectDone.current = true;
    if (settings.connectOnLaunch && settings.vpnDisclosureAccepted && native && !status.tunnelUp && vault.selectedId) {
      connect();
    }
  }, [ready, settings.connectOnLaunch, settings.vpnDisclosureAccepted, native, status.tunnelUp, vault.selectedId, connect]);

  // ---- notification permission: asked once at the first start (Android 13+ shows a dialog)
  const requestNotifications = useCallback(() => {
    if (!native) return;
    try {
      if (native.notificationsAllowed()) {
        setNotificationsAllowed(true);
        return;
      }
      if (!native.requestNotificationPermission()) native.openNotificationSettings();
    } catch {
      // nothing else to try
    }
  }, [native]);

  useEffect(() => {
    if (!ready || !native || settings.notificationAsked) return;
    if (notificationsAllowed) {
      updateSettings({ notificationAsked: true });
      return;
    }
    // Let the first screen render before Android's dialog appears.
    const timer = setTimeout(() => {
      updateSettings({ notificationAsked: true });
      try {
        native.requestNotificationPermission();
      } catch {
        // the Settings screen offers it again
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [ready, native, settings.notificationAsked, notificationsAllowed, updateSettings]);

  const resetAll = useCallback(async () => {
    if (native) {
      try {
        await native.disconnect();
      } catch {
        // continue
      }
      await native.vaultClear();
      native.saveSettings(JSON.stringify(DEFAULT_SETTINGS));
    }
    setVault({ v: 1, selectedId: defaultSelection([]), profiles: [] });
    setVaultError(false);
    setRemoteServers([]);
    setServerList({ state: 'idle', fetchedAt: 0 });
    listFetchedAt.current = 0;
    setSettings({ ...DEFAULT_SETTINGS });
  }, [native]);

  const appVersion = useMemo(() => {
    try {
      return native?.appVersion() ?? '';
    } catch {
      return '';
    }
  }, [native]);

  const value: AppStateValue = {
    ready,
    nativeAvailable: !!native,
    lang,
    t,
    settings,
    updateSettings,
    profiles: vault.profiles,
    selectedId: vault.selectedId,
    selectedProfile,
    selectedServer,
    servers,
    serverList,
    refreshServerList,
    selectProfile,
    saveProfile,
    deleteProfile,
    vaultError,
    status: native ? status : EMPTY_STATUS,
    rates,
    exit,
    exitState,
    refreshExit: runExitCheck,
    busy,
    connect,
    disclosureOpen,
    acceptDisclosure,
    declineDisclosure,
    disconnect,
    reconnect,
    errorText,
    clearError: () => setErrorText(null),
    toast,
    showToast,
    issueText,
    errorMessage,
    resetAll,
    appVersion,
    notificationsAllowed,
    requestNotifications,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
