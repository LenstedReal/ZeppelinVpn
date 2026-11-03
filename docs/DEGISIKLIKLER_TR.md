# Zeppelin VPN 2.0: eski Kotlin sürümüne (1.3) göre değişiklikler

Paket kimliği aynı kaldı: `com.lenstedreal.zeppelinvpn`. Eski Kotlin kodu `main` dalında olduğu gibi duruyor; yeni sürüm `expo` dalında.

## Kaldırılanlar (yanlış ya da tehlikeliydi)

| Eski davranış | Sorun | 2.0'da |
|---|---|---|
| ~20 hazır "sunucu", uydurma ping ve doluluk yüzdeleri, "10 Gbps" | Gerçek değildi; yer tutucu anahtarlar ve başkalarına ait IP adresleri kullanıyordu. Play'de yanıltıcı iddia sayılır. | Tamamen kaldırıldı. Yalnızca kullanıcının kendi profilleri var. |
| `setState(UP)` sonrası hemen "Bağlandı" | Sunucu hiç yanıt vermese de bağlı görünüyordu | "Bağlı" yalnızca gerçek WireGuard el sıkışmasından sonra |
| Bağlanmadan önce kill switch'i kapatıp sonra tüneli açmak | Arada trafik sızabiliyordu | İkinci bir VpnService yok; tünel açıkken Android tüm trafiği tünele yönlendirir, sunucu düşünce tünel açık kalır |
| Elle kesince de interneti kesen kill switch | Senin seçimine aykırıydı | Elle kesince internet hemen açılır; yalnızca beklenmeyen kopmada trafik durur |
| Şifreleme hata verince düz metin saklama | Özel anahtarlar şifresiz kalabiliyordu, `allowBackup=true` ile buluta yedeklenebiliyordu | Keystore AES-256-GCM, düz metin yedeği yok, `allowBackup=false` |
| Depoda kaynağı belirsiz `tunnel-norecord.aar` (içinde derlenmiş `.so` dosyaları) | Bir VPN uygulamasında doğrulanamayan ikili kod risklidir | Resmi `com.wireguard.android:tunnel:1.0.20260102` (Maven Central) |
| Kullanılmayan Firebase AI, App Check, Retrofit, OkHttp, Moshi, Room | APK'yı şişiriyordu, gizlilik beyanını karmaşıklaştırıyordu | Yok |
| README'de olup uygulamada olmayan QR içe aktarma | Yanıltıcıydı | Belgelerde yalnızca gerçekten olan özellikler var |
| Sunucu rehberinde `iptables -A` | Oracle'ın REJECT kurallarının arkasına düştüğü için çalışmıyordu | Tek komutluk betik kuralları `-I` ile başa ekler ve kalıcı kaydeder |

## Eklenenler

- **Gerçek bağlantı sağlığı:** son el sıkışma süresi, indirme/yükleme hızı, toplam veri, bağlantı süresi, çıkış IP / ülke / gecikme (Cloudflare trace, kapatılabilir), "tünel var ama internet yok" tespiti ve çözüm komutu.
- **Akıllı otomatik bağlanma:** Android "Her zaman açık VPN" desteği (uygulama kapalıyken ve açılışta da), uygulama açılınca bağlanma, telefon açılınca bağlanma, ağ gelince ve başlatma hatasında artan aralıklarla yeniden deneme, uygulama güncellemesinden sonra bağlantıyı geri kurma.
- **Profil içe aktarma:** panodan, dosyadan veya elle; satır numaralı Türkçe/İngilizce hata ve uyarılar; sunucu dosyası (wg0.conf) yanlışlıkla yapıştırılırsa açık uyarı; ekranda anahtarlar gizli.
- **Ayarlar:** DNS (profil, Cloudflare, Quad9, AdGuard, Google, özel), MTU, keepalive, kill switch, otomatik bağlanma seçenekleri, çıkış IP kontrolü, tüm verileri silme.
- **Oracle:** tek satırlık kurulum komutu (sha256 doğrulamalı), `status / add / show / list / remove / repair` komutları, uygulama içinde adım adım rehber ve sorun giderme.
- **Uygulama içi VPN açıklaması:** ilk bağlanmadan önce, Android'in izin penceresinden önce, VPN'in ne yaptığını ve verilerin nereye gittiğini anlatan kabul/ret ekranı (Google Play VpnService politikasının istediği "belirgin açıklama").
- **Türkçe ve İngilizce arayüz**, yeni yüksek çözünürlüklü logodan ikon, açılış ekranı ve Play görselleri.
- **GitHub Actions:** her push'ta testler, ShellCheck, imzalı APK + AAB, imza sertifikası kontrolü, etiketlerde GitHub Release.

## Teknik özet

- Arayüz: Expo SDK 58 (React Native 0.88, TypeScript), ek gezinme kütüphanesi yok.
- VPN motoru: `modules/zeppelin-vpn` yerel Expo modülü (Kotlin). Tüm tünel işlemleri tek bir arka plan iş parçacığında sıralı çalışır; Always-on geri çağrısı Application.onCreate'te kaydedilir.
- Minimum Android 8.0 (WireGuard kütüphanesi `java.time` kullanır).

## 2.1.0

- **Canlı durum bildirimi:** VPN açıkken bildirimde bağlantı durumu, anlık indirme/yükleme hızı ve bağlı kalınan süre görünür; bildirimdeki "Bağlantıyı kes" ile kapatılır. Kilit ekranında yalnızca "VPN açık" yazar. Ayarlar → Bildirimler'den kapatılabilir.
- **Bildirim izni:** Android 13 ve üstünde uygulama ilk açılışta bildirim izni ister; izin verilmezse Ayarlar'da "Bildirimlere izin ver" düğmesi çıkar.
- **by LenstedReal:** ana ekranda ve Ayarlar → Hakkında'da geliştirici adı.
- **Hazır sunucu:** Frankfurt (Oracle Cloud). Kendi sunucunu kurma rehberi ve kendi profillerin aynen duruyor.
- **Gizlilik:** politika artık hazır sunucuları da doğru anlatıyor. Hazır sunucuda kayıt tarihleri yalnızca gün olarak tutulur (saat yok); `public-on` sistem günlüklerini yalnızca belleğe alır (en fazla 1 gün), rsyslog'u kapatır ve eski syslog/auth.log kayıtlarını siler.
