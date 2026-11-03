# Zeppelin VPN Gizlilik Politikası / Privacy Policy

Son güncelleme / Last updated: 2026-11-03

Geliştirici / Developer: LenstedReal

İletişim / Contact: [contact.zeppelinvpn@proton.me](mailto:contact.zeppelinvpn@proton.me)

---

## Türkçe

Zeppelin VPN, LenstedReal tarafından geliştirilen açık kaynaklı (GNU GPL v3) bir WireGuard VPN uygulamasıdır. Üç şekilde kullanılır: LenstedReal’in işlettiği hazır sunuculara, LenstedReal’in onayladığı topluluk sunucularına bağlanırsın ya da kendi kurduğun sunucunun profilini eklersin.

**LenstedReal’in hazır sunucuları (ör. Frankfurt, Oracle Cloud Almanya)**
- İlk bağlantıda telefon kendi WireGuard anahtar çiftini üretir. Gizli anahtar telefondan hiç çıkmaz; sunucuya yalnızca açık anahtar gönderilir.
- Sunucuda saklananlar: açık anahtar, sana verilen tünel adresi (ör. 10.67.0.5), kaydın oluşturulduğu ve son kullanıldığı gün (saat yok). 14 gün kullanılmayan kayıtlar kendiliğinden silinir.
- Saklanmayanlar: trafik kaydı, ziyaret ettiğin siteler, DNS sorguların, gerçek IP adresin. Kayıt servisi istek kaydı tutmaz.
- Sunucu çalışırken bazı bilgiler yalnızca bellekte, geçici olarak durur ve diske yazılmaz: WireGuard’ın bağlantıyı sürdürmek için tuttuğu son IP adresin, kötüye kullanımı önlemek için bir saatlik kayıt deneme sayacı. Sunucunun sistem günlükleri de yalnızca bellekte tutulur ve en geç 1 günde silinir.
- Trafiğin telefonla sunucu arasında WireGuard ile şifrelidir. HTTPS kullanan sitelerin içeriği sunucuda da okunamaz. Sunucuyu işleten (LenstedReal) ve barındırma firması (Oracle) teknik olarak bağlantıların üst verisini (hangi IP’ye, ne kadar veri) görebilir; LenstedReal bunu kaydetmez.
- Kayıt isteği şifresiz HTTP ile gider ama içinde gizli bilgi yoktur (yalnızca açık anahtar). Sunucunun anahtarı uygulamaya gömülüdür; başka bir sunucu araya girerse uygulama bağlanmaz.

**Topluluk sunucuları**
- Listede “Topluluk” etiketiyle görünen sunucuları LenstedReal değil, adı listede yazan gönüllüler işletir. Uygulama ilk bağlantıdan önce bunu ayrıca söyler.
- LenstedReal bir sunucuyu listeye almadan önce çalıştığını ve anahtarının doğru olduğunu kontrol eder; işletenler aynı kurulum betiğini kullanmayı ve trafik kaydı tutmamayı taahhüt eder. Ancak LenstedReal bu sunucuların içini denetleyemez. Sunucuyu işleten kişi, bağlantıların üst verisini teknik olarak görebilir.
- Kurallara uymayan sunucular listeden kaldırılır.

**Sunucu listesi**
- Uygulama açılınca güncel hazır sunucu listesi GitHub’dan (raw.githubusercontent.com) indirilir. GitHub bu istekte IP adresini görür. Ayarlar → Gizlilik → “Sunucu listesini güncelle” ile kapatabilirsin; o zaman son indirilen liste kullanılır.

**Kendi sunucun**
- Kendi kurduğun sunucuya bağlanırsan trafik yalnızca senin sunucuna gider; LenstedReal hiçbir şey görmez ve almaz.

**Telefonda saklananlar**
- Profillerin ve hazır sunucu anahtarların: Android Keystore anahtarıyla şifreli, yalnızca bu telefonda. Uygulama yedeklemesi kapalıdır; buluta yedeklenmez.
- Ayarların (dil, DNS, MTU vb.): yalnızca bu telefonda.

**Diğer**
- DNS sorguları tünel içinden, seçtiğin DNS sunucusuna gider.
- Çıkış IP kontrolü (isteğe bağlı, Ayarlar’dan kapatılabilir): bağlıyken https://1.1.1.1/cdn-cgi/trace adresine istek atılır; Cloudflare bu istekte çıkış IP’ni görür. Sonuç yalnızca ekranda gösterilir.
- Durum bildirimi yalnızca telefonunda oluşturulur. Kilit ekranında ayrıntı göstermez, yalnızca “VPN açık” yazar.
- Uygulamada reklam, analiz, izleme veya çökme raporlama kütüphanesi yok. Hesap yok.

**İzinler**
- VPN (VpnService): tüneli kurmak için.
- Bildirim: canlı durum bildirimi için (isteğe bağlı).
- İnternet ve ağ durumu: bağlanmak ve ağ değişimlerini izlemek için.
- Açılışta çalışma: yalnızca “Telefon açılınca bağlan” açıksa.

**Verilerini silmek**
- Ayarlar → Tüm verileri sil ya da uygulamayı kaldır. Hazır sunucudaki kaydın 14 gün kullanılmayınca kendiliğinden silinir.

Uygulama 18 yaş altına yönelik değildir. Bu politika değişirse bu metin güncellenir.

**İletişim**
- Soru, istek ve şikâyetler için: [contact.zeppelinvpn@proton.me](mailto:contact.zeppelinvpn@proton.me)

## English

Zeppelin VPN is an open-source (GNU GPL v3) WireGuard VPN app developed by LenstedReal. You can use it in three ways: connect to ready servers run by LenstedReal, connect to community servers LenstedReal approved, or add the profile of a server you set up yourself.

**LenstedReal’s ready servers (e.g. Frankfurt, Oracle Cloud Germany)**
- On the first connection the phone creates its own WireGuard key pair. The private key never leaves the phone; only the public key is sent to the server.
- Stored on the server: the public key, the tunnel address you were given (e.g. 10.67.0.5), and the day the record was created and last used (no time of day). Records unused for 14 days are deleted automatically.
- Not stored: traffic logs, the sites you visit, your DNS queries, your real IP address. The registration service keeps no request logs.
- While the server runs, some data exists only temporarily in memory and is never written to disk: the last IP address WireGuard needs to keep the connection going, and a one-hour counter of registration attempts to prevent abuse. The server’s system logs are also kept only in memory and deleted within 1 day.
- Your traffic is encrypted with WireGuard between the phone and the server. The content of HTTPS sites cannot be read on the server either. The operator (LenstedReal) and the hosting company (Oracle) can technically see connection metadata (which IP, how much data); LenstedReal does not record it.
- The registration request uses plain HTTP but contains nothing secret (only the public key). The server’s key is built into the app; if another server gets in between, the app refuses to connect.

**Community servers**
- Servers marked “Community” are run not by LenstedReal but by the volunteers named in the list. The app says so again before your first connection.
- Before listing a server, LenstedReal checks that it works and that its key is correct; operators commit to using the same setup script and keeping no traffic logs. LenstedReal cannot inspect these servers from the inside, though. Whoever runs a server can technically see connection metadata.
- Servers that break the rules are removed from the list.

**Server list**
- When the app opens, the current ready-server list is downloaded from GitHub (raw.githubusercontent.com). GitHub sees your IP address in that request. You can turn this off in Settings → Privacy → “Update the server list”; the last downloaded list is used then.

**Your own server**
- If you connect to a server you set up yourself, your traffic goes only to your server; LenstedReal sees and receives nothing.

**Stored on this phone**
- Your profiles and ready-server keys: encrypted with an Android Keystore key and kept only on this phone. App backup is disabled; nothing is backed up to the cloud.
- Your settings (language, DNS, MTU, etc.): only on this phone.

**Other**
- DNS queries go through the tunnel to the DNS server you chose.
- Exit IP check (optional, can be turned off in Settings): while connected the app requests https://1.1.1.1/cdn-cgi/trace; Cloudflare sees your exit IP in that request. The result is only shown on screen.
- The status notification is created only on your phone. On the lock screen it shows no details, only “VPN is on”.
- No advertising, analytics, tracking or crash-reporting libraries. No account.

**Permissions**
- VPN (VpnService): to create the tunnel.
- Notifications: for the live status notification (optional).
- Internet and network state: to connect and follow network changes.
- Run at startup: only if “Connect when the phone starts” is on.

**Deleting your data**
- Settings → Delete all data, or uninstall the app. Your record on a ready server is deleted automatically after 14 days without use.

The app is not directed at children under 18. If this policy changes, this text will be updated.

**Contact**
- Questions, requests and complaints: [contact.zeppelinvpn@proton.me](mailto:contact.zeppelinvpn@proton.me)
