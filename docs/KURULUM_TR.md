# Zeppelin VPN: GitHub'a gönderme, derleme ve telefona kurma

Bu rehber her şeyi telefondan, Termux ile yaptırır. Uygulamanın kodu GitHub'da `main` dalındadır. Güncellemeler sohbette bir `.bundle` dosyası olarak gelir; Termux'ta yerel `expo` dalına alınır ve `main`'e gönderilir. Komutları tek tek çalıştır.

Gerekenler: Termux (git kurulu, GitHub'a push yapabildiğin hesap), Derby Arena için oluşturduğun upload keystore dosyası.

## 1. Dosyaları indir

Sohbetteki **ZeppelinVPN-expo-X.Y.Z.bundle** dosyasını telefonun İndirilenler klasörüne kaydet. Commit geçmişi bu dosyanın içindedir. Aynı adla ikinci kez inerse telefon adın sonuna `(1)` ekler; aşağıdaki komut en yenisini kendisi bulur.

## 2. Depoyu hazırla ve yeni dalı al

```bash
termux-setup-storage            # ~/storage yoksa bir kez; izin ver
cd ~
[ -d ZeppelinVpn ] || git clone https://github.com/LenstedReal/ZeppelinVpn.git
cd ZeppelinVpn
git fetch "$(ls -t ~/storage/downloads/ZeppelinVPN-expo-*.bundle | head -1)" expo:expo
git log --oneline -5 expo
```

## 3. İmza sırlarını ekle (bir kez, push'tan önce)

Aynı upload keystore'u (alias `derby`) kullanmak sorun değil. Önce dosyanın yerini bul:

```bash
ls ~/*.keystore ~/storage/downloads/*.keystore 2>/dev/null
```

### Yol A: `gh` ile (önerilen, şifre ekrana ve dosyaya yazılmaz)

**Komutları tek tek çalıştır, birini bitirmeden diğerini yapıştırma.** `gh auth login` ve şifre soran komutlar etkileşimli: hepsi birden yapıştırılırsa sonraki satırlar soruların cevabı olarak yutulur (örneğin bir komut satırı şifre diye kaydedilir).

1. `pkg install -y gh` (bitmesini bekle)
2. `gh auth login` → sırasıyla **GitHub.com**, **HTTPS**, Git için oturum: **Y**, **Login with a web browser**. Ekranda 8 haneli bir kod çıkar; tarayıcıda `https://github.com/login/device` adresini aç, kodu gir, onayla. Termux'ta "Logged in as LenstedReal" görmelisin.
3. `gh auth status` (giriş yapıldığını doğrular)
4. `R=LenstedReal/ZeppelinVpn`
5. `base64 -w 0 ~/derby-upload.keystore | gh secret set ANDROID_KEYSTORE_BASE64 -R $R`
6. `gh secret set ANDROID_KEY_ALIAS -R $R --body derby`
7. `gh secret set ANDROID_KEYSTORE_PASSWORD -R $R` → "Paste your secret" sorusuna keystore şifresini yaz (görünmez), Enter
8. `gh secret set ANDROID_KEY_PASSWORD -R $R` → anahtar şifresi (keytool'da anahtar şifresi sorulunca Enter'a bastıysan keystore şifresiyle aynıdır)
9. `gh secret list -R $R` → 4 sır görünmeli

### Yol B: GitHub web sitesinden

Depo → **Settings → Secrets and variables → Actions → New repository secret**. Dört sır ekle: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS` (`derby`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`. İlkinin değerini almak için:

```bash
base64 -w 0 ~/derby-upload.keystore > ~/storage/downloads/ks.txt
# ks.txt içeriğini kopyalayıp sır olarak yapıştır, sonra HEMEN sil:
rm ~/storage/downloads/ks.txt
```

Keystore dosyasını ve şifrelerini asla depoya ekleme. `.gitignore` `*.keystore` ve `*.b64` dosyalarını zaten dışarıda tutar.

## 4. GitHub'a gönder (derleme kendiliğinden başlar)

```bash
cd ~/ZeppelinVpn
git push origin expo:main
```

Sırları eklemeden push'larsan da derleme çalışır, ama APK hata ayıklama (debug) anahtarıyla imzalanır ve AAB Play'e yüklenemez. Sırları sonradan eklersen derlemeyi yeniden başlatmak için:

```bash
git commit --allow-empty -m "Derlemeyi yeniden başlat" && git push
```

## 5. Derlemeyi izle ve indir

İlk derleme yaklaşık 15–30 dakika sürer. GitHub → **Actions → Android APK + AAB** → `main` dalındaki son çalışma. Bitince çalışmanın sayfasında **Artifacts** altında iki dosya olur:

- `ZeppelinVPN-apk`: telefona kurulacak APK
- `ZeppelinVPN-aab`: Google Play'e yüklenecek paket

`gh` ile:

```bash
gh run watch -R LenstedReal/ZeppelinVpn
gh run download -R LenstedReal/ZeppelinVpn -n ZeppelinVPN-apk -D ~/storage/downloads/zeppelin
```

"Collect outputs and show signing certificate" adımının çıktısında `CN=` satırı senin keystore bilgilerini göstermeli. `CN=Android Debug` görüyorsan sırlar okunmamış demektir.

## 6. Telefona kur

1. **Eski Zeppelin VPN'i kaldır.** Eski APK farklı bir anahtarla imzalandığı için yeni sürüm üstüne kurulamaz ("Uygulama yüklenmedi"). Eski sürümdeki sahte sunucular zaten çalışmıyordu.
2. İndirdiğin APK'yı aç ve kur. Play Protect "bilinmeyen geliştirici" uyarısı verirse **Yine de yükle** de.
3. Uygulamayı aç → **Kurulum** sekmesindeki adımlarla Oracle sunucunu kur (ya da [ORACLE_TR.md](ORACLE_TR.md)).
4. Betiğin verdiği profili **Sunucular → Panodan yapıştır** ile ekle ve bağlan.

## 7. Sürüm yayınlamak

Ayrı bir şey yapmana gerek yok. `main` dalına her push'ta, imzalama anahtarı ayarlıysa, iş akışı imzalı APK'yı GitHub **Releases** sayfasına koyar. Eski sürümleri (eski debug derlemeleri dahil) etiketleriyle birlikte siler, yani Releases'ta her zaman yalnızca en son sürüm durur. Bağlantıyı sitende paylaşabilirsin. Her yeni sürümde `app.json` içinde `version` ve `android.versionCode` değerlerini artır.

Actions sayfasındaki indirmeler (Artifacts) 14 gün sonra kendiliğinden silinir.

## Derleme hata verirse

Kırmızı adımı aç, son 40–50 satırı kopyalayıp bana gönder. Bu ortamda Android derlemesini çalıştıramadım; ilk derlemede sürüm uyumsuzluğu gibi bir sorun çıkarsa hızlıca düzeltirim. Testler (`npm test`) ve ShellCheck adımları derlemeden önce çalışır; onlar geçiyorsa sorun Gradle tarafındadır.
