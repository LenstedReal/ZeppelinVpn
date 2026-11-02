import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from './src/state/AppState';
import { TabBar, type Tab } from './src/components/TabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfilesScreen } from './src/screens/ProfilesScreen';
import { ServerScreen } from './src/screens/ServerScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { colors, radius, space } from './src/theme';

function Root() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.body}>
        {tab === 'home' ? <HomeScreen onNavigate={setTab} /> : null}
        {tab === 'profiles' ? <ProfilesScreen /> : null}
        {tab === 'server' ? <ServerScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </View>
      {app.toast ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <Text style={styles.toast}>{app.toast}</Text>
        </View>
      ) : null}
      <TabBar
        tab={tab}
        onChange={setTab}
        bottomInset={insets.bottom}
        labels={{
          home: app.t('tab.home'),
          profiles: app.t('tab.profiles'),
          server: app.t('tab.server'),
          settings: app.t('tab.settings'),
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Root />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: 90, alignItems: 'center' },
  toast: {
    backgroundColor: '#1B1E25',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
