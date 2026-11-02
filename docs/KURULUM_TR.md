# Zeppelin VPN 2.0: GitHub'a gönderme, derleme ve telefona kurma

Bu rehber her şeyi telefondan, Termux ile yaptırır. Mevcut `main` dalına ve eski Kotlin koduna dokunulmaz: yeni sürüm ayrı bir `expo` dalına gider.

Gerekenler: Termux (git kurulu, GitHub'a push yapabildiğin hesap), Derby Arena için oluşturduğun upload keystore dosyası.

## 1. Dosyaları indir

Sohbetteki **ZeppelinVPN-expo-2.0.0.bundle** dosyasını telefonun İndirilenler klasörüne kaydet. (ZIP dosyası sadece içeriğe göz atmak için; gönderme işinde bundle kullanılır, çünkü commit geçmişi onun içinde.)

## 2. Depoyu hazırla ve yeni dalı al

```bash
termux-setup-storage            # ~/storage yoksa bir kez; izin ver
cd ~
[ -d ZeppelinVpn ] || git clone https://github.com/LenstedReal/ZeppelinVpn.git
cd ZeppelinVpn
git fetch ~/storage/downloads/ZeppelinVPN-expo-2.0.0.bundle expo:expo
git log --oneline -10 expo      # 9 commit görmelisin
```

İsteğe bağlı güvence (eski Kotlin sürümüne etiket koyar, hiçbir şeyi silmez):

```bash
git tag kotlin-1.3 origin/main
git push origin kotlin-1.3
```

## 3. İmza sırlarını ekle (bir kez, push'tan önce)

Aynı upload keystore'u (alias `derby`) kullanmak sorun değil. Önce dosyanın yerini bul:

```bash
ls ~/*.keystore ~/storage/downloads/*.keystore 2>/dev/null
```

### Yol A: `gh` ile (önerilen, şifre ekrana ve dosyaya yazılmaz)

```bash
pkg install -y gh
gh auth login                   # GitHub.com → HTTPS → Login with a web browser
KS=~/derby-upload.keystore      # dosya başka yerdeyse yolunu yaz
R=LenstedReal/ZeppelinVpn
base64 -w 0 "$KS" | gh secret set ANDROID_KEYSTORE_BASE64 -R $R
gh secret set ANDROID_KEY_ALIAS -R $R --body derby
gh secret set ANDROID_KEYSTORE_PASSWORD -R $R     # keystore şifresini yaz, Enter (görünmez)
gh secret set ANDROID_KEY_PASSWORD -R $R          # anahtar şifresi (keytool'da aynı verdiysen aynısı)
gh secret list -R $R                              # 4 sır görünmeli
```

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
git push -u origin expo
```

Sırları eklemeden push'larsan da derleme çalışır, ama APK hata ayıklama (debug) anahtarıyla imzalanır ve AAB Play'e yüklenemez. Sırları sonradan eklersen derlemeyi yeniden başlatmak için:

```bash
git commit --allow-empty -m "Derlemeyi yeniden başlat" && git push
```

## 5. Derlemeyi izle ve indir

İlk derleme yaklaşık 15–30 dakika sürer. GitHub → **Actions → Android APK + AAB** → `expo` dalındaki çalışma. Bitince çalışmanın sayfasında **Artifacts** altında iki dosya olur:

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
3. Uygulamayı aç → **Sunucu** sekmesindeki adımlarla Oracle sunucunu kur (ya da [ORACLE_TR.md](ORACLE_TR.md)).
4. Betiğin verdiği profili **Profiller → Panodan yapıştır** ile ekle ve bağlan.

## 7. Sürüm yayınlamak (isteğe bağlı)

```bash
git tag v2.0.0
git push origin v2.0.0
```

İş akışı APK'yı otomatik olarak GitHub Releases sayfasına ekler; bağlantıyı paylaşabilirsin. Her yeni sürümde `app.json` içinde `version` ve `android.versionCode` değerlerini artır.

## Derleme hata verirse

Kırmızı adımı aç, son 40–50 satırı kopyalayıp bana gönder. Bu ortamda Android derlemesini çalıştıramadım; ilk derlemede sürüm uyumsuzluğu gibi bir sorun çıkarsa hızlıca düzeltirim. Testler (`npm test`) ve ShellCheck adımları derlemeden önce çalışır; onlar geçiyorsa sorun Gradle tarafındadır.

## İleride `expo` dalını ana dal yapmak

Her şey yolundaysa GitHub → **Settings → General → Default branch → expo**. `main` dalı eski Kotlin sürümü olarak kalır, hiçbir şey silinmez.
