import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import ZeppelinVpn from '../../modules/zeppelin-vpn';
import { Bullet, Button, Card, CodeBlock, InfoRow, Notice, Screen, SectionLabel } from '../components/ui';
import { ConnectButton, type ButtonMode } from '../components/ConnectButton';
import { useApp } from '../state/AppState';
import { colors, space } from '../theme';
import { describe as describeCfg, parseConfig } from '../wireguard/config';
import { flagEmoji, formatAgo, formatBytes, formatDuration, formatRate } from '../lib/format';
import type { Tab } from '../components/TabBar';
import { isOfficial } from '../serverList';
import { AdBanner } from '../ads/AdBanner';

const logo = require('../../assets/logo.png');

export function HomeScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const app = useApp();
  const { t, status, lang, settings } = app;
  const s = status.state;

  const mode: ButtonMode =
    s === 'connected' ? 'on' : s === 'connecting' || app.busy ? 'working' : s === 'reconnecting' || s === 'no_network' ? 'problem' : 'idle';
  const active = status.tunnelUp || s === 'connecting' || s === 'reconnecting' || s === 'no_network';
  const buttonLabel = s === 'connected' ? t('button.disconnect') : active ? t('button.cancel') : t('button.connect');

  const dotColor =
    s === 'connected' ? colors.green : s === 'error' ? colors.red : s === 'disconnected' ? colors.steel : colors.amber;

  let title = t('state.disconnected');
  let sub = t('state.disconnected.sub');
  if (s === 'connecting') {
    title = t('state.connecting');
    sub = t('state.connecting.sub');
  } else if (s === 'connected') {
    title = t('state.connected');
    sub = t('state.connected.sub');
  } else if (s === 'reconnecting') {
    title = t('state.reconnecting');
    const reason = status.error ? app.errorMessage(status.error, status.errorDetail) : '';
    sub = status.blocking
      ? `${reason} ${t('state.reconnecting.blocking')}`.trim()
      : `${reason} ${t('state.reconnecting.retry', { n: Math.max(1, status.attempt) })}`.trim();
  } else if (s === 'no_network') {
    title = t('state.no_network');
    sub = t('state.no_network.sub');
  } else if (s === 'error') {
    title = t('state.error');
    sub = app.errorMessage(status.error, status.errorDetail);
  }

  // The WireGuard library needs Android 8.0+ (java.time); the build targets 8.0+ but this guards old devices anyway.
  const tooOld = Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 26;

  const onButton = () => {
    if (active) app.disconnectByUser();
    else if (!tooOld) app.connect();
  };

  const profile = app.selectedProfile;
  const info = profile ? (() => {
    const parsed = parseConfig(profile.conf);
    return parsed.config ? describeCfg(parsed.config) : null;
  })() : null;

  const copy = async (text: string) => {
    try {
      await ZeppelinVpn?.writeClipboard(text);
      app.showToast(t('server.copied'));
    } catch {
      // clipboard not available
    }
  };

  const uptime = status.connectedSince > 0 ? formatDuration((Date.now() - status.connectedSince) / 1000, lang) : '—';
  const internet =
    app.exitState === 'ok'
      ? { text: t('home.internet.ok'), color: colors.green }
      : app.exitState === 'fail'
        ? { text: t('home.internet.fail'), color: colors.red }
        : app.exitState === 'checking'
          ? { text: t('home.internet.checking'), color: colors.textMuted }
          : app.exitState === 'off'
            ? { text: t('home.internet.off'), color: colors.textDim }
            : { text: '—', color: colors.textMuted };

  return (
    <Screen>
      <View style={styles.header}>
        <Image source={logo} style={styles.headerLogo} />
        <View>
          <Text style={styles.brand}>
            ZEPPELIN <Text style={styles.brandAccent}>VPN</Text>
          </Text>
          <Text style={styles.tagline}>{t('brand.tagline')}</Text>
          <Text style={styles.byline}>{t('brand.by')}</Text>
        </View>
      </View>

      {!app.nativeAvailable ? <Notice tone="error">{t('home.noNative')}</Notice> : null}
      {tooOld ? <Notice tone="error">{t('home.oldAndroid')}</Notice> : null}
      {app.vaultError ? <Notice tone="error">{t('error.VAULT')}</Notice> : null}

      <View style={styles.statusBox}>
        <View style={styles.statusLine}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusTitle}>{title}</Text>
        </View>
        <Text style={styles.statusSub}>{sub}</Text>
      </View>

      <ConnectButton mode={mode} label={buttonLabel} onPress={onButton} disabled={app.busy && s !== 'connecting'} />

      {status.blocking && s !== 'connecting' ? (
        <Button label={t('home.unblock')} onPress={app.disconnect} style={styles.unblock} />
      ) : null}

      {app.errorText ? (
        <Notice tone="error" title={t('state.error')}>
          {app.errorText}
        </Notice>
      ) : null}

      {app.selectedServer ? (
        <Card>
          <View style={styles.profileRow}>
            <View style={styles.profileText}>
              <Text style={styles.cardLabel}>
                {(isOfficial(app.selectedServer) ? t('servers.ready') : t('servers.communityOne')).toLocaleUpperCase()}
              </Text>
              <Text style={styles.profileName} numberOfLines={1}>
                {`${flagEmoji(app.selectedServer.country)} ${app.selectedServer.name}`.trim()}
              </Text>
              <Text style={styles.profileMeta} numberOfLines={1}>
                {t('servers.runBy', {
                  operator: isOfficial(app.selectedServer) ? app.selectedServer.operator : `@${app.selectedServer.operator}`,
                })}
              </Text>
            </View>
            <Button label={t('home.change')} small onPress={() => onNavigate('profiles')} />
          </View>
        </Card>
      ) : profile ? (
        <Card>
          <View style={styles.profileRow}>
            <View style={styles.profileText}>
              <Text style={styles.cardLabel}>{t('home.profile')}</Text>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile.name}
              </Text>
              {info ? (
                <Text style={styles.profileMeta} numberOfLines={1}>
                  {info.endpoint}
                </Text>
              ) : null}
            </View>
            <Button label={t('home.change')} small onPress={() => onNavigate('profiles')} />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.cardTitle}>{t('home.noProfile.title')}</Text>
          <Text style={styles.cardBody}>{t('home.noProfile.body')}</Text>
          <View style={styles.buttonRow}>
            <Button label={t('home.noProfile.server')} variant="primary" onPress={() => onNavigate('server')} style={styles.flex} />
            <Button label={t('home.noProfile.add')} onPress={() => onNavigate('profiles')} style={styles.flex} />
          </View>
        </Card>
      )}

      {s === 'reconnecting' && status.error === 'NO_HANDSHAKE' ? (
        <Notice tone="warn" title={t('hint.noHandshake.title')}>
          <Bullet>{t('hint.noHandshake.1')}</Bullet>
          <Bullet>{t('hint.noHandshake.2')}</Bullet>
          <Bullet>{t('hint.noHandshake.3')}</Bullet>
          <Bullet>{t('hint.noHandshake.4')}</Bullet>
        </Notice>
      ) : null}

      {s === 'connected' && app.exitState === 'fail' ? (
        <Notice tone="warn" title={t('hint.noInternet.title')}>
          <Text style={styles.noticeText}>{t('hint.noInternet.body')}</Text>
          <CodeBlock code="sudo bash zeppelin-oracle-setup.sh repair" copyLabel={t('server.copy')} onCopy={copy} />
        </Notice>
      ) : null}

      {status.tunnelUp ? (
        <>
          <SectionLabel>{t('home.health')}</SectionLabel>
          <Card>
            <InfoRow label={t('home.handshake')} value={formatAgo(status.handshakeAgeSec, lang)} />
            <InfoRow label={t('home.download')} value={formatRate(app.rates.down, lang)} />
            <InfoRow label={t('home.upload')} value={formatRate(app.rates.up, lang)} />
            <InfoRow
              label={t('home.total')}
              value={`↓ ${formatBytes(status.rxBytes, lang)}  ↑ ${formatBytes(status.txBytes, lang)}`}
            />
            <InfoRow label={t('home.uptime')} value={uptime} />
            <InfoRow label={t('home.server')} value={status.endpoint || '—'} />
            <InfoRow label={t('home.internet')} value={internet.text} valueColor={internet.color} />
            {app.exit ? (
              <>
                <InfoRow label={t('home.exitIp')} value={app.exit.ip} />
                <InfoRow
                  label={t('home.location')}
                  value={`${flagEmoji(app.exit.country)} ${app.exit.country}${app.exit.colo ? ` · ${app.exit.colo}` : ''}`.trim()}
                />
                <InfoRow label={t('home.latency')} value={`${app.exit.latencyMs} ms`} />
              </>
            ) : null}
            {settings.exitCheck && s === 'connected' ? (
              <Button label={t('home.refresh')} small onPress={app.refreshExit} style={styles.refresh} />
            ) : null}
          </Card>
        </>
      ) : null}

      {s === 'connected' && !settings.alwaysOnTipDismissed ? (
        <Notice tone="info" title={t('alwaysOn.title')}>
          <Text style={styles.noticeText}>{t('alwaysOn.body')}</Text>
          <Text style={styles.steps}>{t('alwaysOn.steps')}</Text>
          <View style={styles.buttonRow}>
            <Button
              label={t('alwaysOn.open')}
              small
              style={styles.flex}
              onPress={() => {
                if (!ZeppelinVpn?.openVpnSettings()) app.showToast(t('alwaysOn.openFailed'));
              }}
            />
            <Button label={t('alwaysOn.hide')} small variant="ghost" onPress={() => app.updateSettings({ alwaysOnTipDismissed: true })} />
          </View>
        </Notice>
      ) : null}

      <AdBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  headerLogo: { width: 46, height: 46 },
  brand: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  brandAccent: { color: colors.crimson },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  byline: { color: colors.crimson, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  statusBox: { alignItems: 'center', marginTop: space.sm, minHeight: 74 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  statusSub: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: space.xs, paddingHorizontal: space.md },
  unblock: { marginBottom: space.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  profileText: { flex: 1 },
  cardLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  profileMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: space.xs },
  buttonRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  flex: { flex: 1 },
  noticeText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  steps: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: space.sm },
  refresh: { alignSelf: 'flex-end', marginTop: space.sm },
});
