import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bullet, Button } from './ui';
import { useApp } from '../state/AppState';
import { colors, radius, space } from '../theme';

/**
 * Prominent in-app disclosure shown once before Android's VPN permission dialog,
 * as Google Play's VpnService policy expects (consent and non-consent paths).
 */
export function VpnDisclosure() {
  const app = useApp();
  const { t } = app;
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={app.disclosureOpen} transparent animationType="fade" onRequestClose={app.declineDisclosure} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.title}>{t('disclosure.title')}</Text>
          <Text style={styles.body}>{t('disclosure.body')}</Text>
          <Bullet>{t('disclosure.point1')}</Bullet>
          <Bullet>{t('disclosure.point2')}</Bullet>
          <Bullet>{t('disclosure.point3')}</Bullet>
          <Bullet>{t('disclosure.point4')}</Bullet>
          <Text style={styles.next}>{t('disclosure.next')}</Text>
          <Button label={t('disclosure.accept')} variant="primary" onPress={app.acceptDisclosure} style={styles.accept} />
          <Button label={t('disclosure.decline')} variant="ghost" onPress={app.declineDisclosure} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  title: { color: colors.text, fontSize: 21, fontWeight: '800', marginBottom: space.sm },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: space.xs },
  next: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: space.md },
  accept: { marginTop: space.lg },
});
