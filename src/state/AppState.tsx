import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import ZeppelinVpn, { EMPTY_STATUS, normalizeStatus, type TunnelStatus } from '../../modules/zeppelin-vpn';
import { DEFAULT_SETTINGS, resolveOverrides, sanitizeSettings, type Settings } from '../settings';
import { applyOverrides, isIP, parseConfig, serializeConfig, type Issue } from '../wireguard/config';
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

export interface Rates {
  down: number;
  up: number;
}

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

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
  connect: () => Promise<void>;
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
}

const Ctx = createContext<AppStateValue | null>(null);

const VAULT_PROFILES = 'profiles';
const EXIT_INTERVAL_MS = 60_000;

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function readVault(raw: string | null): VaultData {
  if (!raw) return { v: 1, selectedId: null, profiles: [] };
  const data = JSON.parse(raw) as Partial<VaultData>;
  const profiles = Array.isArray(data.profiles)
    ? data.profiles.filter(
        (p): p is Profile => !!p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.conf === 'string',
      )
    : [];
  const selectedId = profiles.some((p) => p.id === data.selectedId) ? (data.selectedId as string) : profiles[0]?.id ?? null;
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
  const [vault, setVault] = useState<VaultData>({ v: 1, selectedId: null, profiles: [] });
  const [vaultError, setVaultError] = useState(false);
  const [status, setStatus] = useState<TunnelStatus>(() => normalizeStatus(native?.getStatus()));
  const [rates, setRates] = useState<Rates>({ down: 0, up: 0 });
  const [exit, setExit] = useState<ExitInfo | null>(null);
  const [exitState, setExitState] = useState<ExitState>('idle');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(true);
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
        try {
          const data = readVault(await native.vaultLoad(VAULT_PROFILES));
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
      const selectedId = current.selectedId === id ? profiles[0]?.id ?? null : current.selectedId;
      await persistVault({ v: 1, profiles, selectedId });
    },
    [persistVault],
  );

  const selectedProfile = vault.profiles.find((p) => p.id === vault.selectedId) ?? null;

  // ---- tunnel control
  const connect = useCallback(async () => {
    setErrorText(null);
    if (!native) {
      setErrorText(translate(lang, 'home.noNative'));
      return;
    }
    const profile = vaultRef.current.profiles.find((p) => p.id === vaultRef.current.selectedId);
    if (!profile) {
      setErrorText(errorMessage('NO_SELECTION'));
      return;
    }
    const parsed = parseConfig(profile.conf);
    if (!parsed.config) {
      setErrorText(errorMessage('BAD_CONFIG', parsed.errors.map(issueText).join(' ')));
      return;
    }
    const effective = serializeConfig(applyOverrides(parsed.config, resolveOverrides(settings, isIP)));
    setBusy(true);
    try {
      const allowed = await native.prepare();
      if (!allowed) {
        setErrorText(errorMessage('NO_PERMISSION'));
        return;
      }
      await native.connect(effective, profile.id, profile.name);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      const now = normalizeStatus(native.getStatus());
      // While the native side retries on its own, the status card already explains it.
      if (now.state !== 'reconnecting') setErrorText(errorMessage(err.code ?? 'UNKNOWN', err.message ?? ''));
    } finally {
      setBusy(false);
    }
  }, [native, lang, settings, errorMessage, issueText]);

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
    if (settings.connectOnLaunch && native && !status.tunnelUp && vault.selectedId) {
      connect();
    }
  }, [ready, settings.connectOnLaunch, native, status.tunnelUp, vault.selectedId, connect]);

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
    setVault({ v: 1, selectedId: null, profiles: [] });
    setVaultError(false);
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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
