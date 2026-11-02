// Android build settings needed by the WireGuard tunnel library.
// Applied by "npx expo prebuild"; nothing here has to be edited by hand.
const { withGradleProperties } = require('expo/config-plugins');

function setProperty(properties, key, value) {
  const existing = properties.find((p) => p.type === 'property' && p.key === key);
  if (existing) existing.value = value;
  else properties.push({ type: 'property', key, value });
}

module.exports = function withZeppelinAndroid(config) {
  return withGradleProperties(config, (cfg) => {
    // The WireGuard library uses java.time (InetEndpoint), which Android ships from 8.0 (API 26).
    setProperty(cfg.modResults, 'android.minSdkVersion', '26');
    // Phones are ARM; leaving out x86 emulator builds halves build time and APK size.
    setProperty(cfg.modResults, 'reactNativeArchitectures', 'armeabi-v7a,arm64-v8a');
    // R8 on a React Native release build needs more than the template's 2 GB.
    setProperty(cfg.modResults, 'org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m');
    return cfg;
  });
};
