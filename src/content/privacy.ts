/** In-app privacy policy. Keep in sync with docs/PRIVACY_POLICY.md. */
export const PRIVACY = {
  tr: `Zeppelin VPN, kendi WireGuard sunucuna (örneğin kendi Oracle Cloud sunucuna) bağlanmanı sağlayan bir istemcidir. Geliştirici herhangi bir VPN sunucusu işletmez ve senden hiçbir veri almaz.

Telefonda saklananlar
• WireGuard profillerin: Android Keystore anahtarıyla şifreli olarak yalnızca bu telefonda saklanır. Uygulama yedeklemesi kapalıdır; profiller buluta yedeklenmez ve geliştiriciye gönderilmez.
• Ayarların (dil, DNS, MTU vb.): yalnızca bu telefonda.

Ağ trafiği
• Bağlıyken trafiğin şifreli olarak profilde yazan sunucuya gider. O sunucuyu işleten (kendi sunucunsa sen) trafiğin üst verisini, bir internet servis sağlayıcısının görebildiği kadar görebilir.
• DNS sorguları profildeki ya da Ayarlar’da seçtiğin DNS sunucusuna tünel içinden gider.
• Hazır sunucular: bir hazır sunucuya ilk bağlandığında telefon kendi WireGuard anahtar çiftini üretir ve sunucuya yalnızca açık anahtarı gönderir. Sunucu bu açık anahtarı, sana verdiği tünel adresini ve son kullanım zamanını saklar; 14 gün kullanılmayan kayıtları siler. Trafik kaydı tutulmaz.
• Çıkış IP kontrolü (isteğe bağlı, Ayarlar’dan kapatılabilir): bağlıyken https://1.1.1.1/cdn-cgi/trace adresine istek atılır; Cloudflare bu istekte çıkış IP adresini görür. Sonuç yalnızca ekranda gösterilir, saklanmaz.

Uygulamada yok
• Reklam, analiz, izleme veya çökme raporlama kütüphanesi yok. Hesap yok.

İzinler
• VPN (VpnService): tüneli kurmak için. • İnternet ve ağ durumu: bağlanmak ve ağ değişimlerini izlemek için. • Açılışta çalışma: yalnızca “Telefon açılınca bağlan” açıksa.

Verilerini silmek
• Ayarlar → Tüm verileri sil, ya da uygulamayı kaldır.`,
  en: `Zeppelin VPN is a client that connects you to your own WireGuard server (for example your own Oracle Cloud server). The developer runs no VPN servers and receives no data from you.

Stored on this phone
• Your WireGuard profiles: encrypted with an Android Keystore key and kept only on this phone. App backup is disabled; profiles are not backed up to the cloud and are never sent to the developer.
• Your settings (language, DNS, MTU, etc.): only on this phone.

Network traffic
• While connected, your traffic goes encrypted to the server in your profile. Whoever runs that server (you, if it is your own) can see traffic metadata the way an internet provider can.
• DNS queries go through the tunnel to the DNS server from your profile or Settings.
• Ready servers: the first time you connect to a ready server, the phone creates its own WireGuard key pair and sends only the public key to the server. The server stores that public key, the tunnel address it gave you and when it was last used, and deletes records unused for 14 days. No traffic logs are kept.
• Exit IP check (optional, can be turned off in Settings): while connected the app requests https://1.1.1.1/cdn-cgi/trace; Cloudflare sees your exit IP address in that request. The result is only shown on screen and not stored.

Not in the app
• No ads, analytics, tracking or crash-reporting libraries. No account.

Permissions
• VPN (VpnService): to create the tunnel. • Internet and network state: to connect and follow network changes. • Run at startup: only if “Connect when the phone starts” is on.

Deleting your data
• Settings → Delete all data, or uninstall the app.`,
};
