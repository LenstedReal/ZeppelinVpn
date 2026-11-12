# Zeppelin VPN 2.1 (Expo) — by LenstedReal

**Hızlı. Şifreli. Kayıt tutmaz.** Zeppelin VPN, LenstedReal'in geliştirdiği açık kaynaklı bir Android WireGuard VPN uygulamasıdır. Üç yolla kullanılır: LenstedReal'in işlettiği hazır sunuculara tek dokunuşla bağlanırsın (şu an: Frankfurt), LenstedReal'in onayladığı **topluluk sunucularını** kullanırsın ya da kendi WireGuard sunucunu (örneğin ücretsiz Oracle Cloud sunucusu) kurup profilini eklersin. Hesap istemez, trafik kaydı tutmaz. 2.4.0'dan itibaren uygulama ekranlarında InMobi reklamları vardır (varsayılan olarak kişiselleştirilmemiş); VPN trafiği hiçbir zaman reklam şirketine gitmez. Ayrıntı: [Reklamlar](#reklamlar).

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
| Topluluk sunucuları | Herkes kendi sunucusunu önerebilir; bot kontrol eder, LenstedReal `onay` etiketiyle onaylar, sunucu yeni APK gerekmeden herkesin listesine girer. Bkz. [docs/TOPLULUK_TR.md](docs/TOPLULUK_TR.md) |
| Canlı bildirim | Bağlantı durumu, anlık hız, bağlı kalınan süre ve "Bağlantıyı kes" düğmesi; kilit ekranında ayrıntı yok |
| Dil | Türkçe ve İngilizce (otomatik ya da elle) |

## Klasörler

```
App.tsx, index.ts            uygulama girişi ve sekmeler
src/                         ekranlar, durum, ayrıştırıcı, ayarlar, çeviriler
modules/zeppelin-vpn/        yerel Expo modülü (Kotlin): tünel, sağlık izleme, kasa, bildirim, açılış alıcısı
plugins/                     Expo config plugin (minSdk 26, ARM derlemeleri, Gradle belleği)
server/                      Oracle/Ubuntu WireGuard kurulum betiği
servers.json                 GitHub'daki hazır sunucu listesi (uygulama açılışta indirir)
scripts/                     sunucu betiğini gömme, topluluk sunucusu botu
tests/                       Node testleri + betiğin sahte komutlarla uçtan uca denemesi
store/                       Play ikonu ve tanıtım görselleri
docs/                        kurulum, Oracle, Play Store, gizlilik, değişiklikler, test raporu
.github/workflows/android.yml  APK + AAB derlemesi
```

## Derleme

Derleme GitHub Actions'ta yapılır: `main` dalına her push'ta imzalı APK ve AAB üretilir ve en son APK, GitHub **Releases** sayfasında tek sürüm olarak yayınlanır (eski sürümler silinir). Adım adım anlatım: [docs/KURULUM_TR.md](docs/KURULUM_TR.md).

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
- [docs/TOPLULUK_TR.md](docs/TOPLULUK_TR.md): topluluk sunucusu önerme, onaylama ve kaldırma
- [docs/KURULUM_TR.md](docs/KURULUM_TR.md): Termux, GitHub, imzalama, APK kurulumu
- [docs/ORACLE_TR.md](docs/ORACLE_TR.md): ücretsiz Oracle sunucusu, adım adım
- [docs/PLAY_STORE_TR.md](docs/PLAY_STORE_TR.md): Play şartları (Kuruluş hesabı), mağaza metinleri, VPN beyanı
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md): gizlilik politikası (TR/EN)
- [docs/DEGISIKLIKLER_TR.md](docs/DEGISIKLIKLER_TR.md): eski Kotlin sürümüne göre farklar
- [docs/TEST_RAPORU_TR.md](docs/TEST_RAPORU_TR.md): neyin test edildiği, neyin edilmediği

## İletişim

Soru, istek ve şikâyetler için: [contact.zeppelinvpn@proton.me](mailto:contact.zeppelinvpn@proton.me). Hata bildirimi ve sunucu önerileri için GitHub Issues da kullanılabilir.

## Reklamlar

2.4.0'dan itibaren InMobi reklamları: ana ekranda 320x50 banner ve bağlantı kesildikten sonra en fazla 10 dakikada bir tam ekran reklam (uygulama açıldıktan sonraki ilk dakikada hiç yok). Reklamlar tünele dokunmaz, bağlanmayı engellemez; bağlanmadan önce reklam gösterilmez.

| | |
|---|---|
| Kimlikler | `src/ads/config.ts`: `INMOBI_ACCOUNT_ID`, `INMOBI_BANNER_PLACEMENT`, `INMOBI_INTERSTITIAL_PLACEMENT`. Hesap kimliği boşken hiç reklam isteği yapılmaz. |
| Rıza | InMobi'ye her açılışta `gdpr = "1"` gönderilir; `gdpr_consent_available`, Ayarlar → Gizlilik → Kişiselleştirilmiş reklamlar anahtarına bağlıdır (varsayılan kapalı). |
| Kod | `modules/zeppelin-vpn/android/.../AdsManager.kt`, `ZeppelinBannerView.kt`; `src/ads/` |
| Kapatmak | Kimlikleri boşaltmak reklamları tamamen kapatır; SDK yine pakette kalır. |

## Lisans

Zeppelin VPN açık kaynaktır: **GNU GPL v3 veya sonrası** ([LICENSE](LICENSE)). Copyright (C) 2026 LenstedReal.

**Ek izin (GPL-3.0 §7):** telif hakkı sahibi LenstedReal, bu programın InMobi Ads SDK (`com.inmobi.monetization:inmobi-ads-kotlin`) ve onun bağımlılıklarıyla birlikte derlenip dağıtılmasına izin verir; bu kütüphanelerin kaynak kodunu açma şartı aranmaz. Bu izin yalnızca InMobi SDK için geçerlidir; programın kendi kodu GPL altında kalır.

Kodu kullanabilir, değiştirebilir ve dağıtabilirsin. Değiştirilmiş bir sürüm dağıtıyorsan onun kaynak kodunu da aynı lisansla açman gerekir. Böylece kimse bu kodun içine izleme ekleyip kapalı bir VPN olarak dağıtamaz.

## Kullanılan kütüphaneler

VPN motoru resmi [WireGuard Android tunnel](https://git.zx2c4.com/wireguard-android) kütüphanesidir (Apache-2.0, Maven Central: `com.wireguard.android:tunnel`). “WireGuard” Jason A. Donenfeld'in tescilli markasıdır; bu proje WireGuard projesiyle bağlantılı değildir.
