# Google Play: şartlar, mağaza metinleri ve beyanlar

## Önce bunu bil: VPN uygulamaları için Kuruluş hesabı şart

**Kural (Google'ın resmi sayfaları):** "VpnService sınıfını kullanmasına izin verilen uygulamalar" sunan geliştiriciler Play Console'a **Kuruluş (Organization)** olarak kayıtlı olmalı ([Play Console Requirements, madde 1.3](https://support.google.com/googleplay/android-developer/answer/10788890?hl=en); [hesap türü seçimi](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en_EN)). Google bunu Temmuz 2024 politika güncellemesiyle duyurdu ve 31 Ağustos 2024'ten itibaren yeni geliştiricilere uyguluyor ([Temmuz 2024 politika özeti](https://services.google.com/fh/files/emails/q324_apac_handout.pdf)). Bazı takip kaynakları mevcut uygulamalar için 30 Eylül 2026 tarihini veriyor; bu tarihi Google'ın resmi sayfalarında doğrulayamadım. Zeppelin VPN gerçek bir VPN olduğu için bu kuralın tam içinde: kişisel hesapla gönderilirse büyük olasılıkla reddedilir.

Hesabının türünü görmek için: Play Console → **Geliştirici hesabı → Hakkınızda**.

### Kişisel hesapla denemenin riski

Google'ın [yaptırım sürecine](https://support.google.com/googleplay/android-developer/answer/9899234?hl=en) göre:

| Sonuç | Hesaba etkisi |
|---|---|
| Red (inceleme geçmez) | Hesabın durumunu etkilemez, ihtar sayılmaz |
| Kaldırma (yayındaki uygulama silinir) | Tek başına ihtar değil; birden fazla kaldırma askıya almaya yol açabilir |
| Askıya alma | İhtar sayılır; tekrarlanan red ve kaldırmalar da askıya almaya yol açabilir |
| Hesap kapatma | Birden fazla ihtardan sonra: tüm uygulamalar (Derby Arena dahil) silinir, açılan yeni hesaplar da kapatılır, kayıt ücreti iade edilmez |

Kişisel hesabın 13 Kasım 2023'ten sonra açıldıysa her yeni uygulama için üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kesintisiz kapalı test** de gerekir ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Güvenli deneme: tek bir gönderim, formlar eksiksiz ve dürüst; hesap türü gerekçesiyle red gelirse tekrar gönderme ve itirazı tekrarlama.

### Yol 1: Hesabı Kuruluş hesabına çevirmek

[Google'ın adımları](https://support.google.com/googleplay/android-developer/answer/16260648): Play Console → **Geliştirici hesabı → Hakkınızda**.

1. Kişisel hesabın kimlik doğrulaması tamamlanmış ve bekleyen uyarı olmamalı.
2. Kuruluşun resmi web sitesini kaydedip doğrulat. Doğrulama Google Search Console üzerinden yapılır; site Search Console'da aynı Google hesabıyla kayıtlıysa onay otomatik gelir. "Hesap türünü değiştir" düğmesi ancak bundan sonra açılır.
3. **Hesap türünü değiştir** → yeni bir kuruluş ödeme profili oluştur. Burada kuruluşun **D-U-N-S numarası** istenir. Kuruluş adı ve adresi D&B kaydı, ödeme profili ve geliştirici hesabında aynı olmalı.
4. Kuruluş türü, büyüklüğü ve iletişim bilgilerini gir; istenirse belgelerle kimlik/kuruluş doğrulamasını tamamla.
5. Ödeme profilini geliştirici hesabına bağla, onayla. Yeni uygulama göndermeden önce **72 saat** beklemen öneriliyor. Kuruluştan kişisel hesaba geri dönülemez; Derby Arena hesapta kalır.

Bilmen gerekenler:

- **D-U-N-S ücretsiz.** Dun & Bradstreet'ten alınır, Türkiye'de D&B'nin yetkili temsilcisi CRIF Türkiye'dir ([kaynak](https://workon.com.tr/blog/duns-numarasi-nedir-nasil-alinir-rehber/)). Standart süre 30 iş gününe kadar, ücretli hızlandırma yaklaşık 8 iş günü. Başvurmadan önce [service.dnb.com](https://service.dnb.com/) üzerinden numaranın zaten olup olmadığına bak ([Google](https://support.google.com/googleplay/android-developer/answer/13628312?hl=tr)). "D-U-N-S kaydı yapıyoruz" diye ücret isteyen aracılara gerek yok.
- **Kayıtlı bir işletme gerekir.** Apple şahıs işletmelerini kuruluş olarak kabul etmiyor; Google'ın sayfalarında böyle bir yasak yazmıyor, ama şahıs şirketinin kabul edileceği de garanti değil. Limited ya da anonim şirket en az sorunlu yol.
- **Kuruluş hesaplarında geliştirici e-postası ve telefonu mağaza sayfasında herkese açık görünür.**
- **12 test kullanıcısı / 14 gün** kuralını Google yalnızca kişisel hesaplar için yazıyor; kuruluşa çevrilen hesapta kalkması büyük olasılık ama Google bunu açıkça yazmıyor ([ayrıntı](https://primetestlab.com/blog/personal-vs-organization-google-play-account-12-testers)).
- Eski bazı rehberler hesap türünün değiştirilemeyeceğini yazıyor; Google'ın güncel yardım sayfası dönüşümü anlatıyor.

### Yol 2: Play dışında dağıtım

APK'yı GitHub Releases'ten paylaşmak (iş akışı `v*` etiketlerinde bunu otomatik yapar). Google'ın [geliştirici doğrulaması](https://support.google.com/android-developer-console/answer/16561738) 30 Eylül 2026'da birkaç ülkede başladı (Endonezya, Singapur, Tayland; bazı haberlerde Brezilya da var) ve 2027'de Türkiye dahil tüm ülkelere yayılacak. O zaman seçenekler:

- **Sınırlı dağıtım hesabı:** ücretsiz, kimlik gerekmez, en fazla 20 cihaz.
- **Tam dağıtım hesabı:** 25 dolar, kimlik doğrulaması gerekir.
- Doğrulanmamış uygulamalar da "gelişmiş akış" (risk onayı ve tek seferlik kurulum adımı) ya da ADB ile kurulabilecek.

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

VpnService kullanımı
Zeppelin VPN, cihazdaki tüm trafiği kullanıcının seçtiği WireGuard sunucusuna şifreli tünelle iletmek için Android VpnService API'sini kullanır. Trafik uygulama veya geliştirici tarafından görülmez, kaydedilmez ve değiştirilmez.

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

Use of VpnService
Zeppelin VPN uses Android's VpnService API to send all device traffic through an encrypted tunnel to the WireGuard server the user chooses. The app and its developer do not see, log or modify this traffic.

Good to know
• Zeppelin VPN is a client, not a VPN service: you need your own WireGuard server or a WireGuard profile from a provider you trust.
• Your own server gives privacy, not anonymity.

WireGuard is a registered trademark of Jason A. Donenfeld. Zeppelin VPN is not affiliated with the WireGuard project.
```

Kaçınılan iddialar: eski sürümdeki "Anonymous & Fast", "10 Gbps" ve hazır sunucu listesi gibi doğrulanamayan ya da yanlış ifadeler kullanılmadı. Play, VPN uygulamalarında yanıltıcı iddialara karşı katıdır.

## VpnService politikası: incelemede istenenler

[Google'ın VpnService kuralları](https://support.google.com/googleplay/android-developer/answer/12564964?hl=en) ve Zeppelin VPN'deki karşılıkları:

| Şart | Zeppelin VPN |
|---|---|
| VPN uygulamanın ana işlevi olmalı | Evet |
| Cihazdan VPN uç noktasına trafik şifrelenmeli | WireGuard (ChaCha20-Poly1305) |
| Belirgin açıklama ve onay olmadan kişisel veri toplanmamalı | Veri toplanmıyor; bağlanmadan önce uygulama içi açıklama ekranı var |
| Başka uygulamaların trafiği para kazanmak için yönlendirilmemeli/değiştirilmemeli | Yapılmıyor |
| VpnService kullanımı mağaza sayfasında belirtilmeli | Tam açıklamalardaki "VpnService" paragrafı |
| Play Console'da VpnService beyan formu | App content bölümünde doldurulacak |
| **Video 1** (en fazla 90 saniye): uygulamanın açılıp VPN'in kullanıldığı | Uygulamayı aç → BAĞLAN → "Korunuyorsun" → bir siteyi aç |
| **Video 2**: uygulama içi açıklama, kabul akışı (VpnService izni verilir) ve ret akışı | İlk bağlanmada çıkan "VPN bağlantısı hakkında" ekranı: bir kez "Şimdi değil", bir kez "Kabul et ve bağlan" → Android izni |

Video 2'yi yeniden çekmek için açıklama ekranını tekrar göstermek gerekirse: Ayarlar → Tüm verileri sil (profili sonra yeniden ekle).

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
