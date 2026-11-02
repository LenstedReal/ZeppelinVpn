# Google Play: şartlar, mağaza metinleri ve beyanlar

## Önce bunu bil: VPN uygulamaları için Kuruluş hesabı şart

Google Play, **VpnService kullanmasına izin verilen uygulamaların Kuruluş (Organization) geliştirici hesabından yayınlanmasını** istiyor ([Play Console Requirements](https://support.google.com/googleplay/android-developer/answer/10788890?hl=en), madde 1.3). Kuruluş hesabı için D-U-N-S numarası gerekir; zorunluluk 30 Eylül 2026'dan beri uygulanıyor ve uymayan uygulamalar kaldırılıyor. Zeppelin VPN bu sınıfa girer, yani **kişisel hesapla yayınlanamaz**.

Seçenekler:

1. **Kuruluş hesabı:** kayıtlı bir işletme (şirket ya da şahıs şirketi) ve ücretsiz alınan D-U-N-S numarası ile yeni bir geliştirici hesabı. Kuruluş hesaplarında kişisel hesaplardaki "12 test kullanıcısı, 14 gün kapalı test" şartı yoktur.
2. **Play dışında dağıtım:** APK'yı GitHub Releases'ten paylaşmak (iş akışı `v*` etiketlerinde bunu otomatik yapar). Google, 30 Eylül 2026'da Brezilya, Endonezya, Singapur ve Tayland'da başlayan geliştirici doğrulamasını 2027'de tüm ülkelere yaymayı planlıyor. O zaman doğrulanmamış geliştiricilerin APK'ları ek adımlarla kurulabilecek; hobi geliştiricileri için 20 cihaza kadar ücretsiz "sınırlı dağıtım" hesabı da var.

Aşağıdaki her şey Kuruluş hesabıyla yayın için hazırdır.

## Hazır dosyalar

| Ne | Nerede |
|---|---|
| Uygulama paketi (AAB) | GitHub Actions → `ZeppelinVPN-aab` |
| 512×512 ikon | `store/play-icon-512.png` |
| Tanıtım görseli 1024×500 | `store/feature-graphic-tr-1024x500.png`, `store/feature-graphic-en-1024x500.png` |
| Gizlilik politikası | `docs/PRIVACY_POLICY.md` (iletişim e-postanı ekleyip herkese açık bir adreste yayınla) |
| Ekran görüntüleri | En az 2 telefon ekran görüntüsü gerekir; APK'yı kurduktan sonra telefondan al (Bağlantı ve Sunucu ekranları) |

## Mağaza metinleri

**Uygulama adı:** Zeppelin VPN

**Kısa açıklama (TR, 70/80):** Kendi WireGuard sunucuna güvenle bağlan. Oracle kurulum rehberi dahil.

**Short description (EN, 75/80):** Connect securely to your own WireGuard server. Oracle setup guide included.

**Tam açıklama (TR):**

```
Zeppelin VPN, kendi WireGuard® sunucuna bağlanman için yapılmış sade ve güvenli bir VPN istemcisidir. Hazır sunucu satmaz, hesap istemez, reklam ve izleme içermez: trafiğin yalnızca senin seçtiğin sunucuya gider.

Öne çıkanlar
• Gerçek bağlantı sağlığı: son el sıkışma, indirme/yükleme hızı, toplam veri, çıkış IP'si, ülke ve gecikme
• Kill switch: sunucu yanıt vermezse trafik şifresiz yoldan gitmez; bağlantıyı kesince internet hemen açılır
• Android "Her zaman açık VPN" desteği ve otomatik yeniden bağlanma
• Profiller Android Keystore ile şifreli saklanır ve yedeklenmez
• Panodan veya dosyadan WireGuard (.conf) profili içe aktarma, anlaşılır hata mesajları
• DNS (Cloudflare, Quad9, AdGuard, Google veya özel), MTU ve keepalive ayarları
• Türkçe ve İngilizce arayüz

Kendi sunucunu yaklaşık 20 dakikada kur
Uygulamadaki rehber, Oracle Cloud'un ücretsiz katmanında kendi WireGuard sunucunu adım adım kurdurur. Tek satırlık kurulum komutu güvenlik duvarı, yönlendirme ve MTU ayarlarını yapar ve telefon profilini üretir.

Bilmen gerekenler
• Zeppelin VPN bir VPN hizmeti değil, istemcidir: kendi WireGuard sunucun ya da güvendiğin bir sağlayıcının WireGuard profili gerekir.
• Kendi sunucun gizlilik sağlar, anonimlik sağlamaz.

WireGuard, Jason A. Donenfeld'in tescilli markasıdır. Zeppelin VPN, WireGuard projesiyle bağlantılı değildir.
```

**Full description (EN):**

```
Zeppelin VPN is a clean, secure VPN client for your own WireGuard® server. It sells no servers, needs no account and has no ads or tracking: your traffic goes only to the server you choose.

Highlights
• Real connection health: last handshake, download/upload speed, data used, exit IP, country and latency
• Kill switch: if the server stops answering, traffic never falls back to the unencrypted path; disconnecting restores the internet immediately
• Android Always-on VPN support and automatic reconnect
• Profiles are encrypted with the Android Keystore and never backed up
• Import WireGuard (.conf) profiles from the clipboard or a file, with clear error messages
• DNS (Cloudflare, Quad9, AdGuard, Google or custom), MTU and keepalive settings
• Turkish and English interface

Set up your own server in about 20 minutes
The built-in guide walks you through running your own WireGuard server on Oracle Cloud's free tier. A one-line setup command configures the firewall, forwarding and MTU and creates your phone profile.

Good to know
• Zeppelin VPN is a client, not a VPN service: you need your own WireGuard server or a WireGuard profile from a provider you trust.
• Your own server gives privacy, not anonymity.

WireGuard is a registered trademark of Jason A. Donenfeld. Zeppelin VPN is not affiliated with the WireGuard project.
```

Kaçınılan iddialar: eski sürümdeki "Anonymous & Fast", "10 Gbps" ve hazır sunucu listesi gibi doğrulanamayan ya da yanlış ifadeler kullanılmadı. Play, VPN uygulamalarında yanıltıcı iddialara karşı katıdır.

## App content (Uygulama içeriği) cevapları

| Bölüm | Cevap |
|---|---|
| Privacy policy | `PRIVACY_POLICY.md`'nin yayınlandığı herkese açık adres |
| Ads | Reklam yok |
| App access | Giriş gerekmiyor. İnceleme notu: "Uygulama kullanıcının kendi WireGuard sunucusuna bağlanır. Test için şu profili kullanın: …" (incelemeye özel bir test sunucusu profili vermek onayı kolaylaştırır) |
| Content rating | Anketi doldur: kategori Utility/Tools; şiddet, cinsellik, kumar yok |
| Target audience | 18 ve üzeri |
| Data safety | Veri toplanmıyor ve paylaşılmıyor; veriler cihazda şifreli; kullanıcı verilerini silebilir. Not: bağlıyken isteğe bağlı çıkış IP kontrolü Cloudflare'e istek atar; inceleme bunu "IP adresi paylaşımı" sayarsa `src/settings.ts` içinde `exitCheck` varsayılanını `false` yapıp yeniden derle. |
| VPN service (VpnService beyanı) | VPN çekirdek işlev: evet. Kullanım: kullanıcının kendi sunucusuna şifreli tünel (WireGuard). Trafik cihazdan VPN uç noktasına uçtan uca şifreli. Kullanıcı verisi toplanmaz, satılmaz; reklamlar değiştirilmez veya engellenmez. |
| News app / Health / Financial | Hayır |

## Yayın akışı (Kuruluş hesabı ile)

1. Play Console → **Create app** → ad: Zeppelin VPN, dil: Türkçe (tr-TR), uygulama, ücretsiz.
2. **App content** bölümlerini yukarıdaki tabloya göre doldur.
3. **Store listing**: metinler, ikon, tanıtım görseli, ekran görüntüleri; İngilizce çeviri ekle.
4. **Testing → Internal testing** → yeni sürüm → GitHub Actions'tan indirdiğin `.aab` dosyasını yükle. Play App Signing varsayılan olarak açıktır; senin keystore'un "upload key" olur.
5. İç testte kendi telefonunda dene, sonra **Production**'a terfi et.

Paket adı `com.lenstedreal.zeppelinvpn`, `versionCode` 5. Her güncellemede `app.json` içindeki `version` ve `android.versionCode` artırılmalı.

## Hedef API

Expo SDK 58 `targetSdkVersion` olarak API 36 kullanır; Google Play'in 31 Ağustos 2026'dan sonraki yeni sürümler için istediği hedef API karşılanır.
