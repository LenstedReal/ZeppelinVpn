import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ZeppelinVpn, { NativeBanner } from '../../modules/zeppelin-vpn';
import { INMOBI_BANNER_PLACEMENT, adsConfigured } from './config';

function sdkReady(): boolean {
  try {
    return !!ZeppelinVpn && ZeppelinVpn.adsReady();
  } catch {
    return false;
  }
}

/** 320x50 InMobi banner (2.4.0). Takes no space when ads are off, the SDK is not up yet or no ad came. */
export function AdBanner() {
  const placement = INMOBI_BANNER_PLACEMENT.trim();
  const enabled = !!NativeBanner && adsConfigured() && placement.length > 0;
  const [ready, setReady] = useState(() => enabled && sdkReady());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // 2.4.1: a failed banner (often "no fill") is tried again after 90 s, up to 10 times.
  useEffect(() => {
    if (!failed || attempt >= 10) return;
    const timer = setTimeout(() => {
      setAttempt((a) => a + 1);
      setFailed(false);
    }, 90_000);
    return () => clearTimeout(timer);
  }, [failed, attempt]);

  // The SDK starts asynchronously; check every 2 s for up to two minutes.
  useEffect(() => {
    if (!enabled || ready) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (sdkReady()) {
        setReady(true);
        clearInterval(timer);
      } else if (tries >= 60) {
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [enabled, ready]);

  if (!enabled || !ready || failed || !NativeBanner) return null;
  return (
    <View style={styles.box}>
      <NativeBanner
        key={attempt}
        style={styles.banner}
        placementId={placement}
        onAdState={(e) => {
          if (e.nativeEvent.state === 'failed') setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', marginTop: 16 },
  banner: { width: 320, height: 50 },
});
