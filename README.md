# Zeppelin VPN 2.1 (Expo) — by LenstedReal

**Hazır sunucu ya da kendi sunucun.** Zeppelin VPN, LenstedReal'in geliştirdiği bir Android WireGuard VPN uygulamasıdır. İki yolla kullanılır: LenstedReal'in işlettiği hazır sunuculara tek dokunuşla bağlanırsın (şu an: Frankfurt) ya da kendi WireGuard sunucunu (örneğin ücretsiz Oracle Cloud sunucusu) kurup profilini eklersin. Hesap istemez, reklam veya izleme kütüphanesi içermez, trafik kaydı tutmaz.

> English summary: Android WireGuard VPN app by LenstedReal. Connect to ready servers run by the developer or to your own server. Expo (React Native + TypeScript) UI, a Kotlin module that wraps the official WireGuard tunnel library, a live status notification, a one-command Oracle Cloud server script with an optional shared-server registration API, and a GitHub Actions build that produces a signed APK and AAB. Architecture: [docs/MIMARI_TR.md](docs/MIMARI_TR.md).

## Neler var

| Özellik | Nasıl çalışır |
|---|---|
| Gerçek bağlantı sağlığı | WireGuard el sıkışması, indirme/yükleme hızı, toplam veri, süre, çıkış IP / ülke / gecikme (Cloudflare trace, kapatılabilir), “tünel var ama internet yok” tespiti |
| Kill switch | Sunucu yanıt vermezse tünel açık kalır, trafik sızmaz; elle kesince internet hemen açılır. İstenirse kapatılabilir. |
| Akıllı otomatik bağlanma | Android “Her zaman açık VPN” desteği, uygulama açılınca / telefon açılınca bağlanma, ağ gelince ve başlatma hatasında yeniden deneme, güncellemeden sonra bağlantıyı geri kurma |
| Güvenlik | Profiller Android Keystore anahtarıyla AES-256-GCM şifreli; yedekleme kapalı; düz metin yedeği yok |
| Oracle sunucu | `server/zeppelin-oracle-setup.sh`: Oracle'ın REJECT kurallarını aşan güvenlik duvarı, MTU, NAT, profil üretimi, durum ve onarım komutları. Uygulama bu betiği tek satırlık komut olarak kopyalar. |
| Hazır sunucular | Telefon kendi anahtarını üretir, sunucuya yalnızca açık anahtar gider; sunucu anahtarı uygulamaya sabitlenmiştir. Kayıtlar yalnızca gün olarak tutulur, 14 gün kullanılmayınca silinir. |
| Canlı bildirim | Bağlantı durumu, anlık hız, bağlı kalınan süre ve "Bağlantıyı kes" düğmesi; kilit ekranında ayrıntı yok |
| Dil | Türkçe ve İngilizce (otomatik ya da elle) |

## Klasörler

```
App.tsx, index.ts            uygulama girişi ve sekmeler
src/                         ekranlar, durum, ayrıştırıcı, ayarlar, çeviriler
modules/zeppelin-vpn/        yerel Expo modülü (Kotlin): tünel, sağlık izleme, kasa, bildirim, açılış alıcısı
plugins/                     Expo config plugin (minSdk 26, ARM derlemeleri, Gradle belleği)
server/                      Oracle/Ubuntu WireGuard kurulum betiği
tests/                       Node testleri + betiğin sahte komutlarla uçtan uca denemesi
store/                       Play ikonu ve tanıtım görselleri
docs/                        kurulum, Oracle, Play Store, gizlilik, değişiklikler, test raporu
.github/workflows/android.yml  APK + AAB derlemesi
```

## Derleme

Derleme GitHub Actions'ta yapılır: `expo` dalına her push'ta imzalı APK ve AAB üretilir. Adım adım anlatım: [docs/KURULUM_TR.md](docs/KURULUM_TR.md).

Yerelde (Android SDK + JDK 17 olan bir bilgisayarda):

```bash
npm install
npx expo install --fix
npm test
npx expo run:android
```

Sunucu betiğini değiştirirsen uygulamadaki kopyayı yenile: `npm run embed-server-script`.

## Belgeler

- [docs/MIMARI_TR.md](docs/MIMARI_TR.md): mimari, dosyalar, bağlanma akışı, hazır sunucu tasarımı, derleme hattı
- [docs/KURULUM_TR.md](docs/KURULUM_TR.md): Termux, GitHub, imzalama, APK kurulumu
- [docs/ORACLE_TR.md](docs/ORACLE_TR.md): ücretsiz Oracle sunucusu, adım adım
- [docs/PLAY_STORE_TR.md](docs/PLAY_STORE_TR.md): Play şartları (Kuruluş hesabı), mağaza metinleri, VPN beyanı
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md): gizlilik politikası (TR/EN)
- [docs/DEGISIKLIKLER_TR.md](docs/DEGISIKLIKLER_TR.md): eski Kotlin sürümüne göre farklar
- [docs/TEST_RAPORU_TR.md](docs/TEST_RAPORU_TR.md): neyin test edildiği, neyin edilmediği

## Lisanslar

VPN motoru resmi [WireGuard Android tunnel](https://git.zx2c4.com/wireguard-android) kütüphanesidir (Apache-2.0, Maven Central: `com.wireguard.android:tunnel`). “WireGuard” Jason A. Donenfeld'in tescilli markasıdır; bu proje WireGuard projesiyle bağlantılı değildir.
