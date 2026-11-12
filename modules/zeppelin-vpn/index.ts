import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';
import { NativeModule, requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';

export type TunnelState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'no_network' | 'error';

/** Mirrors TunnelManager.buildSnapshot() in Kotlin. */
export interface TunnelStatus {
  state: TunnelState;
  tunnelUp: boolean;
  /** Tunnel is up but not working: traffic is held back instead of leaking. */
  blocking: boolean;
  profileId: string;
  profileName: string;
  endpoint: string;
  /** Seconds since the last WireGuard handshake, -1 if none yet. */
  handshakeAgeSec: number;
  rxBytes: number;
  txBytes: number;
  /** Epoch ms of the first handshake of this session, 0 if none. */
  connectedSince: number;
  error: string | null;
  errorDetail: string | null;
  attempt: number;
  hasNetwork: boolean;
  updatedAt: number;
}

type ZeppelinVpnEvents = {
  onStatus: (status: TunnelStatus) => void;
};

declare class ZeppelinVpnNativeModule extends NativeModule<ZeppelinVpnEvents> {
  isPrepared(): boolean;
  prepare(): Promise<boolean>;
  connect(conf: string, profileId: string, profileName: string): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Partial<TunnelStatus>;
  saveSettings(json: string): void;
  loadSettings(): string | null;
  vaultSave(name: string, json: string): Promise<void>;
  vaultLoad(name: string): Promise<string | null>;
  vaultClear(): Promise<void>;
  pickTextFile(): Promise<string | null>;
  readClipboard(): Promise<string | null>;
  writeClipboard(text: string): Promise<void>;
  openVpnSettings(): boolean;
  notificationsAllowed(): boolean;
  /** Shows Android's notification permission dialog; false when no dialog can be shown. */
  requestNotificationPermission(): boolean;
  openNotificationSettings(): boolean;
  generateKeyPair(): { privateKey: string; publicKey: string };
  deviceLanguage(): string;
  appVersion(): string;
  /** InMobi ads (2.4.0). Empty account ID = ads stay off. */
  adsInit(accountId: string, personalized: boolean): void;
  adsReady(): boolean;
  /** 2.4.1: short text with the last SDK / interstitial / banner state, shown in Settings. */
  adsStatus(): string;
  adsPreloadInterstitial(placementId: string): void;
  /** "closed" after the user closed the full-screen ad; "none" at once when no ad was ready. */
  adsShowInterstitial(): Promise<'closed' | 'none'>;
}

/** null when running without the native code (Expo Go, web). The UI shows a notice then. */
const ZeppelinVpn = requireOptionalNativeModule<ZeppelinVpnNativeModule>('ZeppelinVpn');

export default ZeppelinVpn;

export type BannerProps = ViewProps & {
  placementId: string;
  onAdState?: (e: { nativeEvent: { state: 'loaded' | 'failed' } }) => void;
};

/** Native InMobi 320x50 banner; null without the native code. */
export const NativeBanner: ComponentType<BannerProps> | null = ZeppelinVpn
  ? requireNativeViewManager<BannerProps>('ZeppelinVpn')
  : null;

export const EMPTY_STATUS: TunnelStatus = {
  state: 'disconnected',
  tunnelUp: false,
  blocking: false,
  profileId: '',
  profileName: '',
  endpoint: '',
  handshakeAgeSec: -1,
  rxBytes: 0,
  txBytes: 0,
  connectedSince: 0,
  error: null,
  errorDetail: null,
  attempt: 0,
  hasNetwork: true,
  updatedAt: 0,
};

export function normalizeStatus(raw: Partial<TunnelStatus> | null | undefined): TunnelStatus {
  if (!raw || typeof raw !== 'object' || !raw.state) return { ...EMPTY_STATUS };
  return { ...EMPTY_STATUS, ...raw };
}
