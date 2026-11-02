import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Notice } from './ui';
import { useApp } from '../state/AppState';
import { colors, font, radius, space } from '../theme';
import { describe as describeCfg, maskSecrets, parseConfig, serializeConfig } from '../wireguard/config';

export interface EditorInput {
  id?: string;
  name: string;
  conf: string;
}

export function ProfileEditor({
  input,
  onClose,
}: {
  input: EditorInput | null;
  onClose: (saved: boolean) => void;
}) {
  const app = useApp();
  const { t } = app;
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!input) return;
    const parsed = parseConfig(input.conf);
    const suggested =
      input.name ||
      parsed.config?.name ||
      (parsed.config ? describeCfg(parsed.config).host : '') ||
      `${app.lang === 'tr' ? 'Profil' : 'Profile'} ${app.profiles.length + 1}`;
    setName(suggested.slice(0, 40));
    setText(input.conf);
    setShowKeys(input.conf.trim().length === 0);
    setSaving(false);
    // Only when a new editor session starts; later list or language changes must not reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const result = useMemo(() => parseConfig(text), [text]);
  const canSave = !!result.config && name.trim().length > 0 && !saving;

  const save = async () => {
    if (!result.config) return;
    setSaving(true);
    try {
      const cleanName = name.trim().slice(0, 40);
      await app.saveProfile({ id: input?.id, name: cleanName, conf: serializeConfig({ ...result.config, name: cleanName }) });
      app.showToast(t('profiles.saved'));
      onClose(true);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      app.showToast(app.errorMessage(err.code ?? 'UNKNOWN', err.message));
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!input} animationType="slide" onRequestClose={() => onClose(false)} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{input?.id ? t('editor.editTitle') : t('editor.importTitle')}</Text>

          <Field label={t('editor.name')} value={name} onChangeText={setName} placeholder={t('editor.namePlaceholder')} maxLength={40} />

          <Text style={styles.label}>{t('editor.config')}</Text>
          {showKeys ? (
            <TextInput
              style={styles.config}
              value={text}
              onChangeText={setText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              placeholder={'[Interface]\nPrivateKey = …\nAddress = 10.66.66.2/32\n\n[Peer]\nPublicKey = …\nEndpoint = 1.2.3.4:51820\nAllowedIPs = 0.0.0.0/0, ::/0'}
              placeholderTextColor={colors.textDim}
            />
          ) : (
            <>
              <Text style={[styles.config, styles.masked]} selectable={false}>
                {maskSecrets(text)}
              </Text>
              <Text style={styles.hint}>{t('editor.maskedHint')}</Text>
            </>
          )}
          <Button
            label={showKeys ? t('editor.hideKeys') : t('editor.showKeys')}
            small
            variant="ghost"
            onPress={() => setShowKeys(!showKeys)}
            style={styles.toggleKeys}
          />

          {result.errors.length > 0 && text.trim().length > 0 ? (
            <Notice tone="error" title={t('editor.errors')}>
              {result.errors.slice(0, 6).map((issue, i) => (
                <Text key={i} style={styles.issue}>
                  • {app.issueText(issue)}
                </Text>
              ))}
            </Notice>
          ) : null}
          {result.config && result.warnings.length > 0 ? (
            <Notice tone="warn" title={t('editor.warnings')}>
              {result.warnings.slice(0, 6).map((issue, i) => (
                <Text key={i} style={styles.issue}>
                  • {app.issueText(issue)}
                </Text>
              ))}
            </Notice>
          ) : null}
          {input?.id && app.status.tunnelUp && app.status.profileId === input.id ? (
            <Notice tone="info">{t('profiles.applyNext')}</Notice>
          ) : null}

          <View style={styles.actions}>
            <Button label={t('editor.cancel')} onPress={() => onClose(false)} style={styles.flex} />
            <Button label={t('editor.save')} variant="primary" onPress={save} disabled={!canSave} style={styles.flex} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: space.lg },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: space.xs },
  config: {
    minHeight: 220,
    backgroundColor: '#08090C',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: font.mono,
    fontSize: 12.5,
    lineHeight: 18,
    padding: space.md,
  },
  masked: { color: colors.textMuted },
  hint: { color: colors.textDim, fontSize: 12, marginTop: space.xs },
  toggleKeys: { alignSelf: 'flex-start', marginVertical: space.sm, paddingHorizontal: 0 },
  issue: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  flex: { flex: 1 },
});
