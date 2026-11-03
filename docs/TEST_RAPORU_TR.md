# Test raporu: Zeppelin VPN 2.0

Bu sürüm bulut çalışma ortamında hazırlandı. O ortamda npm, Google Maven ve Gradle sunucularına erişim yoktu ve gerçek bir telefon yoktu. Aşağıda neyin gerçekten çalıştırıldığı ve neyin çalıştırılmadığı ayrı ayrı yazılı.

## Burada çalıştırılan ve geçen kontroller

| Kontrol | Araç | Sonuç |
|---|---|---|
| Birim testleri (19 test) | Node 22 `node --test` | 19/19 geçti |
| Sunucu betiği sözdizimi ve kalite | `bash -n`, ShellCheck 0.11.0 (stil düzeyi) | Temiz |
| Sunucu betiğinin uçtan uca denemesi | `tests/server-dry-run.sh` (apt, iptables, systemctl, wg sahte komutlarla) | Geçti |
| Gömülü kurulum komutu | base64 → gunzip → `sha256sum -c` zinciri gerçekten çalıştırıldı | Betik birebir aynı çıktı |
| Kotlin modülü | kotlinc 2.2.21; gerçek WireGuard sınıfları + elle yazılmış Android/Expo imza saplamaları | Hatasız derlendi |
| Uygulama kodu (TS/TSX) | TypeScript 6.0.3 strict; React, React Native ve Expo için elle yazılmış tip saplamaları | Hata yok |
| GitHub Actions dosyası | actionlint 1.7.8 + ShellCheck | Temiz |
| Config plugin | Node'da sahte `expo/config-plugins` ile | `minSdk 26`, ARM mimarileri ve Gradle belleği doğru yazılıyor |
| İkonlar | Adaptive ikon daire, squircle ve kare maskelerde önizlendi | Logo taşmıyor |

Birim testlerinin kapsadıkları: WireGuard `.conf` ayrıştırıcı (geçerli/geçersiz örnekler, CRLF, BOM, satır içi yorum, yanlışlıkla yapıştırılan sunucu dosyası, IPv6 ve uç nokta biçimleri), yazdır→ayrıştır gidiş-dönüşü, DNS/MTU/keepalive ayarlarının profile uygulanması, ayar doğrulama, sayı/süre biçimleri, Türkçe ve İngilizce metinlerin anahtar ve yer tutucu eşleşmesi, ayrıştırıcının ve Kotlin modülünün ürettiği her hata kodunun çevirisi, Cloudflare trace ayrıştırma, betiğin ürettiği telefon profilinin uygulama tarafından uyarısız kabul edilmesi.

Sunucu betiği denemesinde doğrulananlar: ilk kurulum, ikinci kurulumda kuralların ve profillerin çoğalmaması, 6 güvenlik duvarı kuralının tam metni, sunucu MTU 1420 ve telefon MTU 1280, `add` (yeni IP), aynı adla ve geçersiz adla `add` reddi, `list`, `remove` (sunucu dosyasından ve ev dizininden silme), boşalan IP'nin yeniden kullanılması, `status`, `show`, gizli dosyaların 600 izni, ekrana basılan profilin dosyayla birebir aynı olması.

## Burada yapılamayanlar

- **`npm install` ve Metro paketleme:** npm kayıt sunucusu erişilemezdi. TypeScript denetimi gerçek React Native tipleri yerine benim yazdığım saplamalarla yapıldı.
- **Android derlemesi (Gradle):** Google Maven ve Gradle sunucuları erişilemezdi. İlk gerçek derleme GitHub Actions'ta olacak. Kotlin derlemesi gerçek `expo-modules-core` yerine imza saplamalarıyla yapıldı; Expo API'sinde küçük bir imza farkı varsa Actions'ta derleme hatası çıkabilir.
- **Gerçek cihaz testi yapılmadı.** VPN izni, bağlanma, el sıkışma, kill switch, Her zaman açık VPN, açılışta bağlanma, dosya seçici ve pano telefonda denenmedi.
- **Gerçek Oracle sunucusu:** betik gerçek bir Oracle makinesinde çalıştırılmadı, yalnızca sahte sistem komutlarıyla denendi.

## İlk cihaz testinde kontrol listesi

1. Eski Zeppelin VPN'i kaldır, yeni APK'yı kur ve aç. Dil doğru mu?
2. Sunucular → Elle yaz: bozuk bir metin yaz, Türkçe hata satırlarını gör. Sonra betiğin verdiği profili **Panodan yapıştır** ile ekle.
3. İlk **BAĞLAN**'da "VPN bağlantısı hakkında" ekranı çıkmalı: "Şimdi değil" bağlanmamalı; "Kabul et ve bağlan" Android'in VPN iznini açmalı. Bu ekran bir kez gösterilir.
4. Android izni → "Bağlanıyor…" → "Korunuyorsun". Son el sıkışma birkaç saniye önce olmalı, hızlar değişmeli, **Çıkış IP** sunucunun IP'si olmalı.
5. **Kill switch:** sunucuda `sudo systemctl stop wg-quick@wg0`. En geç yaklaşık 3 dakika içinde "Bağlantı koptu, yeniden deneniyor" görünmeli ve internet durmalı (WireGuard oturumu 180 saniye geçerli kalır, tespit süresi buradan gelir; "İnternet erişimi: Yok" satırı genelde daha erken görünür). Sonra `sudo systemctl start wg-quick@wg0`: bağlantı kendiliğinden düzelmeli.
6. **KES:** internet hemen gelmeli.
7. Wi-Fi ↔ mobil veri geçişi: bağlantı kopmadan devam etmeli.
8. Ayarlar → Android VPN ayarları → Her zaman açık VPN + VPN olmadan bağlantıları engelle → telefonu yeniden başlat: kendiliğinden bağlanmalı.
9. Her zaman açık kapalıyken "Telefon açılınca bağlan"ı aç → yeniden başlat: bağlanmalı.
10. Ayarlar → Tüm verileri sil: profiller ve ayarlar gitmeli, VPN kapanmalı.

Bir adım beklendiği gibi çalışmazsa ekran görüntüsü ve mümkünse `adb logcat -s ZeppelinVpn WireGuard/GoBackend` çıktısını gönder.
