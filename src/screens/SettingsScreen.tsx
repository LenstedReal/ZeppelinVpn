import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ZeppelinVpn from '../../modules/zeppelin-vpn';
import { Button, Card, Field, Notice, Screen, ScreenTitle, SectionLabel, Segmented, ToggleRow } from '../components/ui';
import { useApp } from '../state/AppState';
import { parseDnsList, type DnsMode, type KeepaliveMode, type Language, type MtuMode } from '../settings';
import { isIP } from '../wireguard/config';
import { PRIVACY } from '../content/privacy';
import { colors, space } from '../theme';

export function SettingsScreen() {
  const app = useApp();
  const { t, settings, updateSettings, lang } = app;
  const insets = useSafeAreaInsets();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const customInvalid = settings.dnsMode === 'custom' && parseDnsList(settings.customDns, isIP) === null;

  const confirmReset = () => {
    Alert.alert(t('settings.reset'), t('settings.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await app.resetAll();
            app.showToast(t('settings.resetDone'));
          } catch (e) {
            const err = e as { code?: string; message?: string };
            app.showToast(app.errorMessage(err.code ?? 'UNKNOWN', err.message));
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenTitle title={t('settings.title')} />

      <SectionLabel>{t('settings.language')}</SectionLabel>
      <Card>
        <Segmented<Language>
          value={settings.language}
          onChange={(language) => updateSettings({ language })}
          options={[
            { value: 'auto', label: t('settings.language.auto') },
            { value: 'tr', label: 'Türkçe' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>

      <SectionLabel>{t('settings.notifications')}</SectionLabel>
      <Card>
        <ToggleRow
          label={t('settings.statusNotification')}
          description={t('settings.statusNotification.desc')}
          value={settings.statusNotification}
          onChange={(statusNotification) => updateSettings({ statusNotification })}
        />
        {app.nativeAvailable && settings.statusNotification && !app.notificationsAllowed ? (
          <>
            <Text style={styles.warn}>{t('settings.notificationsOff')}</Text>
            <Button
              label={t('settings.notificationsAllow')}
              small
              variant="primary"
              onPress={app.requestNotifications}
              style={styles.inlineButton}
            />
          </>
        ) : null}
      </Card>

      <SectionLabel>{t('settings.protection')}</SectionLabel>
      <Card>
        <ToggleRow
          label={t('settings.killSwitch')}
          description={settings.killSwitch ? t('settings.killSwitch.on') : t('settings.killSwitch.off')}
          value={settings.killSwitch}
          onChange={(killSwitch) => updateSettings({ killSwitch })}
        />
        <Text style={styles.note}>{t('settings.killSwitch.note')}</Text>
        <Text style={styles.steps}>{t('alwaysOn.steps')}</Text>
        <Text style={styles.note}>{t('alwaysOn.note')}</Text>
        <Button
          label={t('alwaysOn.open')}
          small
          onPress={() => {
            if (!ZeppelinVpn?.openVpnSettings()) app.showToast(t('alwaysOn.openFailed'));
          }}
          style={styles.inlineButton}
          disabled={!app.nativeAvailable}
        />
      </Card>

      <SectionLabel>{t('settings.auto')}</SectionLabel>
      <Card>
        <ToggleRow
          label={t('settings.autoReconnect')}
          description={t('settings.autoReconnect.desc')}
          value={settings.autoReconnect}
          onChange={(autoReconnect) => updateSettings({ autoReconnect })}
        />
        <ToggleRow
          label={t('settings.connectOnLaunch')}
          value={settings.connectOnLaunch}
          onChange={(connectOnLaunch) => updateSettings({ connectOnLaunch })}
        />
        <ToggleRow
          label={t('settings.connectOnBoot')}
          description={t('settings.connectOnBoot.desc')}
          value={settings.connectOnBoot}
          onChange={(connectOnBoot) => updateSettings({ connectOnBoot })}
        />
      </Card>

      <SectionLabel>{t('settings.tunnel')}</SectionLabel>
      <Card>
        <Text style={styles.label}>{t('settings.dns')}</Text>
        <Segmented<DnsMode>
          value={settings.dnsMode}
          onChange={(dnsMode) => updateSettings({ dnsMode })}
          options={[
            { value: 'profile', label: t('settings.dns.profile') },
            { value: 'cloudflare', label: 'Cloudflare' },
            { value: 'quad9', label: 'Quad9' },
            { value: 'adguard', label: 'AdGuard' },
            { value: 'google', label: 'Google' },
            { value: 'custom', label: t('settings.dns.custom') },
          ]}
        />
        {settings.dnsMode === 'custom' ? (
          <View style={styles.customDns}>
            <Field
              label={t('settings.dns.custom')}
              value={settings.customDns}
              onChangeText={(customDns) => updateSettings({ customDns })}
              placeholder={t('settings.dns.customPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
            {customInvalid ? <Text style={styles.error}>{t('settings.dns.invalid')}</Text> : null}
          </View>
        ) : null}

        <Text style={[styles.label, styles.spaced]}>{t('settings.mtu')}</Text>
        <Segmented<MtuMode>
          value={settings.mtuMode}
          onChange={(mtuMode) => updateSettings({ mtuMode })}
          options={[
            { value: 'profile', label: t('settings.dns.profile') },
            { value: '1280', label: '1280' },
            { value: '1380', label: '1380' },
            { value: '1420', label: '1420' },
          ]}
        />
        <Text style={styles.help}>{t('settings.mtu.desc')}</Text>

        <Text style={[styles.label, styles.spaced]}>{t('settings.keepalive')}</Text>
        <Segmented<KeepaliveMode>
          value={settings.keepaliveMode}
          onChange={(keepaliveMode) => updateSettings({ keepaliveMode })}
          options={[
            { value: 'auto', label: t('settings.keepalive.auto') },
            { value: '15', label: lang === 'tr' ? '15 sn' : '15 s' },
            { value: '25', label: lang === 'tr' ? '25 sn' : '25 s' },
            { value: 'off', label: t('settings.keepalive.off') },
          ]}
        />
        <Text style={styles.help}>{t('settings.keepalive.desc')}</Text>

        <Text style={styles.note}>{t('settings.applyNext')}</Text>
        {app.status.tunnelUp ? (
          <Button label={t('settings.reconnectNow')} small onPress={app.reconnect} style={styles.inlineButton} disabled={app.busy} />
        ) : null}
      </Card>

      <SectionLabel>{t('settings.privacy')}</SectionLabel>
      <Card>
        <ToggleRow
          label={t('settings.exitCheck')}
          description={t('settings.exitCheck.desc')}
          value={settings.exitCheck}
          onChange={(exitCheck) => updateSettings({ exitCheck })}
        />
        <Button label={t('settings.privacyPolicy')} small onPress={() => setPrivacyOpen(true)} style={styles.inlineButton} />
      </Card>

      <SectionLabel>{t('settings.about')}</SectionLabel>
      <Card>
        <Text style={styles.label}>
          {t('settings.version')}: {app.appVersion || '—'}
        </Text>
        <Text style={styles.label}>
          {t('settings.developer')}: <Text style={styles.brand}>LenstedReal</Text>
        </Text>
        <Text style={styles.help}>{t('settings.license')}</Text>
      </Card>

      <SectionLabel>{t('settings.danger')}</SectionLabel>
      <Card>
        <Button label={t('settings.reset')} variant="danger" onPress={confirmReset} />
      </Card>

      {!app.nativeAvailable ? <Notice tone="error">{t('home.noNative')}</Notice> : null}

      <Modal visible={privacyOpen} animationType="slide" onRequestClose={() => setPrivacyOpen(false)} statusBarTranslucent>
        <View style={[styles.modal, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.modalTitle}>{t('settings.privacyPolicy')}</Text>
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.policy}>{PRIVACY[lang]}</Text>
          </ScrollView>
          <Button label={t('common.close')} variant="primary" onPress={() => setPrivacyOpen(false)} />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: space.sm },
  spaced: { marginTop: space.lg },
  help: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: space.sm },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: space.md },
  steps: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: space.sm },
  error: { color: colors.red, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.amber, fontSize: 13, lineHeight: 18, marginTop: space.md },
  brand: { color: colors.crimson, fontWeight: '800' },
  inlineButton: { alignSelf: 'flex-start', marginTop: space.md },
  customDns: { marginTop: space.md },
  modal: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: space.md },
  modalScroll: { flex: 1, marginBottom: space.md },
  policy: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
});
