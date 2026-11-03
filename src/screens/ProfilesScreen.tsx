import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ZeppelinVpn from '../../modules/zeppelin-vpn';
import { Button, Card, Notice, Screen, ScreenTitle } from '../components/ui';
import { ProfileEditor, type EditorInput } from '../components/ProfileEditor';
import { useApp, type Profile } from '../state/AppState';
import { colors, radius, space } from '../theme';
import { describe as describeCfg, parseConfig } from '../wireguard/config';
import { flagEmoji } from '../lib/format';
import { SERVER_ID_PREFIX } from '../wireguard/servers';

export function ProfilesScreen() {
  const app = useApp();
  const { t } = app;
  const [editing, setEditing] = useState<EditorInput | null>(null);

  const fromClipboard = async () => {
    try {
      const text = await ZeppelinVpn?.readClipboard();
      if (!text || text.trim().length === 0) {
        app.showToast(t('profiles.clipboardEmpty'));
        return;
      }
      setEditing({ name: '', conf: text });
    } catch {
      app.showToast(t('profiles.clipboardEmpty'));
    }
  };

  const fromFile = async () => {
    try {
      const text = await ZeppelinVpn?.pickTextFile();
      if (text == null) return;
      setEditing({ name: '', conf: text });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      app.showToast(app.errorMessage(err.code ?? 'READ_FAILED', err.message));
    }
  };

  const remove = (p: Profile) => {
    if (app.status.tunnelUp && app.status.profileId === p.id) {
      app.showToast(t('profiles.deleteActive'));
      return;
    }
    Alert.alert(t('profiles.delete'), t('profiles.deleteConfirm', { name: p.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await app.deleteProfile(p.id);
          app.showToast(t('profiles.deleted'));
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenTitle title={t('profiles.title')} subtitle={t('profiles.subtitle')} />

      {app.servers.length > 0 ? (
        <>
          <Text style={styles.section}>{t('servers.title').toLocaleUpperCase()}</Text>
          <Text style={styles.sectionNote}>{t('servers.subtitle')}</Text>
          {app.servers.map((srv) => {
            const id = SERVER_ID_PREFIX + srv.id;
            const selected = id === app.selectedId;
            return (
              <Card key={id} style={selected ? styles.selectedCard : undefined}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {`${flagEmoji(srv.country)} ${srv.name}`.trim()}
                  </Text>
                  {selected ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('profiles.selected')}</Text>
                    </View>
                  ) : null}
                </View>
                {!selected ? (
                  <View style={styles.actions}>
                    <Button label={t('profiles.use')} small variant="primary" onPress={() => app.selectProfile(id)} />
                  </View>
                ) : null}
              </Card>
            );
          })}
          <Text style={styles.section}>{t('servers.mine').toLocaleUpperCase()}</Text>
        </>
      ) : null}

      <View style={styles.importRow}>
        {app.nativeAvailable ? (
          <>
            <Button label={t('profiles.paste')} variant="primary" onPress={fromClipboard} style={styles.importMain} />
            <View style={styles.importSecondary}>
              <Button label={t('profiles.file')} small onPress={fromFile} style={styles.flex} />
              <Button label={t('profiles.manual')} small onPress={() => setEditing({ name: '', conf: '' })} style={styles.flex} />
            </View>
          </>
        ) : (
          <Button label={t('profiles.manual')} onPress={() => setEditing({ name: '', conf: '' })} />
        )}
      </View>

      {app.vaultError ? <Notice tone="error">{t('error.VAULT')}</Notice> : null}
      {app.profiles.length === 0 ? <Notice tone="info">{t('profiles.empty')}</Notice> : null}

      {app.profiles.map((p) => {
        const parsed = parseConfig(p.conf);
        const info = parsed.config ? describeCfg(parsed.config) : null;
        const selected = p.id === app.selectedId;
        const connectedHere = app.status.tunnelUp && app.status.profileId === p.id;
        return (
          <Card key={p.id} style={selected ? styles.selectedCard : undefined}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              {selected ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t('profiles.selected')}</Text>
                </View>
              ) : null}
            </View>
            {info ? (
              <>
                <Text style={styles.meta} numberOfLines={1}>
                  {info.endpoint}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {info.address} · {info.fullTunnel ? t('profiles.fullTunnel') : t('profiles.splitTunnel')}
                </Text>
              </>
            ) : null}
            <View style={styles.actions}>
              {!selected ? (
                <Button label={t('profiles.use')} small variant="primary" onPress={() => app.selectProfile(p.id)} />
              ) : null}
              <Button label={t('profiles.edit')} small onPress={() => setEditing({ id: p.id, name: p.name, conf: p.conf })} />
              <Button label={t('profiles.delete')} small variant="danger" onPress={() => remove(p)} disabled={connectedHere} />
            </View>
          </Card>
        );
      })}

      <ProfileEditor input={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  importRow: { marginBottom: space.md, gap: space.sm },
  importMain: {},
  importSecondary: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  selectedCard: { borderColor: colors.crimson },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  badge: {
    backgroundColor: colors.crimsonDeep,
    borderColor: colors.crimson,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
  section: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, marginTop: space.md, marginBottom: space.sm },
  sectionNote: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: space.sm },
});
