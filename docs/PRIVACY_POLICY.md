# Zeppelin VPN Gizlilik Politikası / Privacy Policy

Son güncelleme / Last updated: 2026-11-03

İletişim / Contact: **[buraya iletişim e-postanı yaz / your contact e-mail]**

---

## Türkçe

Zeppelin VPN, kendi WireGuard sunucuna (örneğin kendi Oracle Cloud sunucuna) bağlanmanı sağlayan bir istemcidir. Geliştirici herhangi bir VPN sunucusu işletmez ve senden hiçbir veri almaz.

**Telefonda saklananlar**

- WireGuard profillerin: Android Keystore anahtarıyla şifreli olarak yalnızca bu telefonda saklanır. Uygulama yedeklemesi kapalıdır; profiller buluta yedeklenmez ve geliştiriciye gönderilmez.
- Ayarların (dil, DNS, MTU vb.): yalnızca bu telefonda.

**Ağ trafiği**

- Bağlıyken trafiğin şifreli olarak profilde yazan sunucuya gider. O sunucuyu işleten (kendi sunucunsa sen) trafiğin üst verisini bir internet servis sağlayıcısının görebildiği kadar görebilir.
- DNS sorguları, profildeki ya da Ayarlar'da seçtiğin DNS sunucusuna tünel içinden gider.
- Çıkış IP kontrolü (isteğe bağlı, Ayarlar'dan kapatılabilir): bağlıyken `https://1.1.1.1/cdn-cgi/trace` adresine istek atılır. Cloudflare bu istekte çıkış IP adresini görür ([Cloudflare gizlilik politikası](https://www.cloudflare.com/privacypolicy/)). Sonuç yalnızca ekranda gösterilir, saklanmaz.

**Uygulamada olmayanlar:** reklam, analiz, izleme veya çökme raporlama kütüphanesi; kullanıcı hesabı.

**İzinler:** VPN (VpnService) tüneli kurmak için; internet ve ağ durumu bağlanmak ve ağ değişimlerini izlemek için; açılışta çalışma yalnızca "Telefon açılınca bağlan" açıksa.

**Çocuklar:** Uygulama 18 yaş altına yönelik değildir.

**Verilerini silmek:** Ayarlar → Tüm verileri sil, ya da uygulamayı kaldır. Geliştiricide senin hakkında silinecek bir veri yoktur.

**Değişiklikler:** Bu politika değişirse bu sayfa güncellenir.

## English

Zeppelin VPN is a client that connects you to your own WireGuard server (for example your own Oracle Cloud server). The developer runs no VPN servers and receives no data from you.

**Stored on your phone**

- Your WireGuard profiles: encrypted with an Android Keystore key and kept only on this phone. App backup is disabled; profiles are not backed up to the cloud and are never sent to the developer.
- Your settings (language, DNS, MTU, etc.): only on this phone.

**Network traffic**

- While connected, your traffic goes encrypted to the server in your profile. Whoever runs that server (you, if it is your own) can see traffic metadata the way an internet provider can.
- DNS queries go through the tunnel to the DNS server from your profile or Settings.
- Exit IP check (optional, can be turned off in Settings): while connected the app requests `https://1.1.1.1/cdn-cgi/trace`. Cloudflare sees your exit IP address in that request ([Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)). The result is only shown on screen and not stored.

**Not in the app:** advertising, analytics, tracking or crash-reporting libraries; user accounts.

**Permissions:** VPN (VpnService) to create the tunnel; internet and network state to connect and follow network changes; run at startup only if "Connect when the phone starts" is on.

**Children:** The app is not directed at children under 18.

**Deleting your data:** Settings → Delete all data, or uninstall the app. The developer holds no data about you to delete.

**Changes:** If this policy changes, this page will be updated.
