import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ZeppelinVpn from '../../modules/zeppelin-vpn';
import { Bullet, Button, Card, CodeBlock, Screen, ScreenTitle, SectionLabel } from '../components/ui';
import { useApp } from '../state/AppState';
import { colors, space } from '../theme';
import { NOTES, SCRIPT_COMMANDS, STEPS, TROUBLE } from '../content/guide';
import { INSTALL_COMMAND } from '../generated/serverScript';

export function ServerScreen() {
  const app = useApp();
  const { t, lang } = app;

  const copy = async (text: string, message?: string) => {
    if (!ZeppelinVpn) return;
    try {
      await ZeppelinVpn.writeClipboard(text);
      app.showToast(message ?? t('server.copied'));
    } catch {
      // ignore
    }
  };

  return (
    <Screen>
      <ScreenTitle title={t('server.title')} subtitle={t('server.subtitle')} />

      {STEPS.map((step, i) => (
        <Card key={i}>
          <View style={styles.stepHead}>
            <View style={styles.stepNo}>
              <Text style={styles.stepNoText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title[lang]}</Text>
          </View>
          <Text style={styles.body}>{step.body[lang]}</Text>
          {step.commands?.map((c) => (
            <CodeBlock key={c} code={c} copyLabel={t('server.copy')} onCopy={(code) => copy(code)} />
          ))}
          {step.install ? (
            <Button
              label={t('server.copyInstall')}
              variant="primary"
              onPress={() => copy(INSTALL_COMMAND, t('server.installCopied'))}
              style={styles.install}
              disabled={!app.nativeAvailable}
            />
          ) : null}
          {step.alwaysOn ? (
            <Button
              label={t('alwaysOn.open')}
              onPress={() => {
                if (!ZeppelinVpn?.openVpnSettings()) app.showToast(t('alwaysOn.openFailed'));
              }}
              style={styles.install}
              disabled={!app.nativeAvailable}
            />
          ) : null}
        </Card>
      ))}

      <SectionLabel>{t('server.notes')}</SectionLabel>
      <Card>
        {NOTES.map((n, i) => (
          <Bullet key={i}>{n[lang]}</Bullet>
        ))}
      </Card>

      <SectionLabel>{t('server.trouble')}</SectionLabel>
      {TROUBLE.map((item, i) => (
        <Card key={i}>
          <Text style={styles.q}>{item.q[lang]}</Text>
          <Text style={styles.body}>{item.a[lang]}</Text>
          {item.command ? <CodeBlock code={item.command} copyLabel={t('server.copy')} onCopy={(code) => copy(code)} /> : null}
        </Card>
      ))}

      <SectionLabel>{t('server.commands')}</SectionLabel>
      <Card>
        {SCRIPT_COMMANDS.map((c) => (
          <View key={c.command} style={styles.cmd}>
            <Text style={styles.cmdDesc}>{c.desc[lang]}</Text>
            <CodeBlock code={c.command} copyLabel={t('server.copy')} onCopy={(code) => copy(code)} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  stepNo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.crimsonDeep,
    borderColor: colors.crimson,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNoText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  stepTitle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  install: { marginTop: space.md },
  q: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: space.xs },
  cmd: { marginBottom: space.sm },
  cmdDesc: { color: colors.textMuted, fontSize: 13 },
});
