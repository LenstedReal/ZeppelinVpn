# Oracle Cloud'da ücretsiz WireGuard sunucusu (adım adım)

Toplam süre yaklaşık 20 dakika. Hepsi telefondan yapılabilir: Oracle web konsolu (tarayıcı) ve Termux. Aynı adımlar uygulamanın **Sunucu** sekmesinde de var; oradaki "Kurulum komutunu kopyala" düğmesi aşağıdaki 7. adımı tek dokunuşa indirir.

## 1. Oracle hesabı

- oracle.com/cloud/free → **Start for free**. Kart doğrulaması istenir; Always Free kaynaklar ücretlendirilmez.
- **Home Region** sonradan değiştirilemez ve Always Free sunucu yalnızca orada açılabilir. Sana yakın bir Avrupa bölgesi seç (Frankfurt, Amsterdam, Milano vb.).

## 2. SSH anahtarı (Termux)

Termux'u F-Droid'den ya da GitHub'dan kur (Play Store sürümü eskidir).

```bash
pkg update -y && pkg install -y openssh
ssh-keygen -t ed25519 -f ~/.ssh/oracle -N ""
cat ~/.ssh/oracle.pub
```

Son komutun yazdığı `ssh-ed25519 ...` satırının tamamını kopyala. Özel anahtar `~/.ssh/oracle` telefonda kalır, kimseyle paylaşma.

## 3. Ağ (VCN)

Menü ☰ → **Networking → Virtual cloud networks → Start VCN Wizard → Create VCN with Internet Connectivity** → ad ver → Next → Create. Varsayılanlar doğrudur (internet ağ geçidi, public subnet ve SSH için TCP 22 kuralı otomatik gelir).

## 4. Sunucu

Menü ☰ → **Compute → Instances → Create instance**:

- **Image:** Canonical Ubuntu 24.04
- **Shape:** VM.Standard.E2.1.Micro (Always Free). Kapasite varsa **VM.Standard.A1.Flex** (1 OCPU, 6 GB) çok daha hızlıdır; "Out of capacity" hatası alırsan E2.1.Micro'ya dön.
- **Networking:** 3. adımdaki VCN ve onun public subnet'i, **Assign a public IPv4 address** açık
- **Add SSH keys:** Paste public keys → 2. adımdaki satır

**Create** → durum **RUNNING** olunca **Public IP address** değerini not et.

## 5. UDP 51820 (Oracle bulut güvenlik duvarı)

Sunucu sayfasında **Subnet** bağlantısı → **Security Lists → Default Security List → Add Ingress Rules**:

| Alan | Değer |
|---|---|
| Source Type | CIDR |
| Source CIDR | `0.0.0.0/0` |
| IP Protocol | **UDP** (TCP değil) |
| Destination Port Range | `51820` |

Bu kural sunucunun içinden eklenemez; yoksa uygulama "Sunucudan yanıt yok" der.

## 6. Sunucuya bağlan

```bash
ssh -i ~/.ssh/oracle ubuntu@SUNUCU_IP
```

İlk bağlantıdaki soruya `yes` de.

## 7. Tek komutla kurulum

Uygulamada **Sunucu → Kurulum komutunu kopyala**, SSH oturumuna yapıştır (Termux'ta uzun bas → Paste), Enter. Komut betiği yazar, sha256 ile doğrular ve çalıştırır.

Alternatifler:

- Depo herkese açıksa: `curl -fsSL https://raw.githubusercontent.com/LenstedReal/ZeppelinVpn/expo/server/zeppelin-oracle-setup.sh -o zeppelin-oracle-setup.sh && sudo bash zeppelin-oracle-setup.sh`
- Dosyayı Termux'tan göndermek: `scp -i ~/.ssh/oracle zeppelin-oracle-setup.sh ubuntu@SUNUCU_IP:` sonra sunucuda `sudo bash zeppelin-oracle-setup.sh`

Betiğin yaptıkları:

1. `wireguard-tools`, `iptables-persistent` kurar (yeni sunucuda Ubuntu güncellemesi bitene kadar en fazla 10 dakika bekler).
2. IP yönlendirmeyi kalıcı açar.
3. Güvenlik duvarı kurallarını Oracle'ın `REJECT` kurallarının **önüne** ekler (`-I`) ve `netfilter-persistent save` ile kalıcı yapar: UDP 51820 girişi, wg0 yönlendirmesi, NAT, TCP MSS ayarı.
4. Sunucu MTU'sunu 1420 yapar (Oracle ağ kartı 9000 kullanır; WireGuard'ın kendi seçimi telefona giden büyük paketlerin kaybolmasına yol açar).
5. Anahtarları üretir, `wg-quick@wg0` servisini açar ve açılışta otomatik başlatır.
6. İlk telefon profilini (`telefon`) üretir: önceden paylaşılan anahtar (PresharedKey), MTU 1280, DNS 1.1.1.1, keepalive 25, tüm trafik tünelden.

Betik tekrar çalıştırılabilir: kuralları çoğaltmaz, mevcut profilleri silmez, başka bir araçla yazılmış `wg0.conf` dosyasının üzerine yazmaz.

## 8. Profili uygulamaya ekle

Betik sonunda profil metni şu satırların arasında görünür:

```
----- ZEPPELIN PROFILE BEGIN -----
# Name: Oracle-telefon
[Interface]
...
PersistentKeepalive = 25
----- ZEPPELIN PROFILE END -----
```

Termux'ta ekrana uzun bas → **Select** → `# Name:` satırından `PersistentKeepalive = 25` satırına kadar seç → **Copy**. Uygulamada **Profiller → Panodan yapıştır → Kaydet**. Metni tekrar görmek için sunucuda: `sudo bash zeppelin-oracle-setup.sh show telefon`.

## 9. Bağlan ve doğrula

**Bağlantı → BAĞLAN** → Android'in VPN iznini onayla. "Korunuyorsun" yazmalı, **Çıkış IP** Oracle sunucunun Public IP'si olmalı.

## 10. Tam koruma (önerilir)

Android **Ayarlar → Ağ ve internet → VPN → Zeppelin VPN yanındaki ⚙ → Her zaman açık VPN** ve **VPN olmadan bağlantıları engelle**. Telefon açılırken ya da uygulama güncellenirken bile trafik sızmaz.

## Sunucu betiği komutları

| Komut | Ne yapar |
|---|---|
| `sudo bash zeppelin-oracle-setup.sh status` | Sağlık kontrolü ve çözüm önerileri |
| `sudo bash zeppelin-oracle-setup.sh add tablet` | Yeni cihaz için profil |
| `sudo bash zeppelin-oracle-setup.sh show telefon` | Profili tekrar göster |
| `sudo bash zeppelin-oracle-setup.sh list` | Profiller ve son el sıkışmaları |
| `sudo bash zeppelin-oracle-setup.sh remove tablet` | Profili iptal et |
| `sudo bash zeppelin-oracle-setup.sh repair` | Yönlendirme ve güvenlik duvarını onar, WireGuard'ı yeniden başlat |

## Bilmen gerekenler

- **E2.1.Micro:** 1/8 OCPU, 1 GB RAM, yaklaşık 50 Mbps internet. Gezinme ve video için yeterli; A1.Flex daha hızlıdır.
- **Trafik:** ayda 10 TB dışarı giden veri ücretsizdir.
- **Boşta kalma:** Oracle, 7 gün boyunca CPU, ağ ve (A1'de) bellek kullanımı çok düşük kalan Always Free sunucuları geri alabilir. Keepalive bunu engellemez. Sunucuyu düzenli kullan ya da hesabı "Pay As You Go"ya yükselt (Always Free kaynaklar yine ücretsizdir).
- **Her cihaza ayrı profil:** aynı profili iki cihazda aynı anda kullanmak bağlantıların birbirini düşürmesine yol açar.
- **Gizlilik ≠ anonimlik:** kendi sunucun trafiğini operatöründen gizler ama çıkış IP'si Oracle hesabına bağlıdır.
- **IPv6:** sunucu yalnızca IPv4 iletir. Profil `::/0` içerdiği için telefonun IPv6 trafiği tünel dışına sızmaz, uygulamalar IPv4'e düşer.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| "Bağlanıyor…"da kalıyor, "Sunucudan yanıt yok" | Önce 5. adımdaki UDP 51820 kuralı. Sonra sunucuda `status`. Sunucu yeniden kurulduysa profili yeniden ekle. |
| "Korunuyorsun" ama sayfalar açılmıyor | Sunucuda `sudo bash zeppelin-oracle-setup.sh repair` |
| Bazı siteler/uygulamalar takılıyor | Ayarlar → MTU → 1280 |
| SSH: `Permission denied (publickey)` | Kullanıcı `ubuntu`, anahtar `-i ~/.ssh/oracle`; sunucuyu oluştururken bu anahtarın `.pub` satırını yapıştırdığından emin ol |
| SSH: `Connection timed out` | IP doğru mu, sunucu RUNNING mi; VCN sihirbazının eklediği TCP 22 kuralı duruyor mu |
| `status` "genel IP değişmiş" diyor | `remove` + `add` ile profili yeniden üret |

## Grok'un verdiği adımlarla farklar

| Grok'un adımı | Durum | Doğrusu |
|---|---|---|
| Always Free, kart, home region kalıcı | Doğru | Aynı |
| VCN sihirbazı, Ubuntu 24.04, E2.1.Micro, public IP, SSH anahtarı | Doğru | Aynı |
| Security List'te UDP 51820 | Doğru | Aynı; "TCP değil UDP" uyarısı eklendi |
| `ssh -i anahtar ubuntu@IP` | Eksik | Termux'ta `openssh` kurulumu ve anahtar üretimi gerekiyordu |
| `iptables -A FORWARD ...` ile PostUp | **Yanlış** | Oracle Ubuntu imajında `INPUT` ve `FORWARD` zincirleri `REJECT` ile biter; `-A` ile eklenen kural hiç çalışmaz. Kurallar `-I` ile başa eklenmeli ve kalıcı kaydedilmeli. |
| MTU | **Eksik** | Oracle ağ kartı MTU 9000; sunucuda 1420, telefonda 1280 |
| İstemci `.conf` dosyası | **Eksik** | Betik telefon profilini üretip ekrana ve `~/zeppelin-telefon.conf` dosyasına yazar |
| "Keepalive 25 boşta silinmeyi engeller" | **Yanlış** | Keepalive yalnızca NAT bağlantısını canlı tutar; Oracle'ın boşta kalma kuralını etkilemez |
| A1 kotası | Güncel değil | Always Free A1 için toplam 2 OCPU / 12 GB |
| Hız | Eksik | E2.1.Micro yaklaşık 50 Mbps ile sınırlı |
