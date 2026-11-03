# Topluluk sunucuları

Zeppelin VPN'de hazır sunucu listesi iki kaynaktan oluşur:

- **Uygulamaya gömülü sunucular** (`src/content/servers.ts`): şu an Frankfurt. İnternet olmasa bile görünürler ve indirilen liste onları değiştiremez.
- **GitHub'daki liste** ([`servers.json`](../servers.json)): uygulama her açılışta bu dosyayı indirir. Buraya eklenen sunucu, **yeni APK gerekmeden**, herkesin uygulamasında bir sonraki açılışta görünür.

Listede iki tür sunucu vardır:

| Etiket | Kim işletir | Nasıl girer |
|---|---|---|
| İşleten: LenstedReal | LenstedReal | LenstedReal kendi önerisini onaylar ya da dosyaya kendisi ekler |
| Topluluk · İşleten: @kullanıcı | Sunucuyu öneren GitHub kullanıcısı | Öneri + LenstedReal'in onayı |

## Sunucusunu önermek isteyen kişi ne yapar?

1. Kendi sunucusunu kurar ([ORACLE_TR.md](ORACLE_TR.md) adım 1-9).
2. Oracle Security List'e **TCP 51821** giriş kuralını ekler (UDP 51820 zaten olmalı).
3. Sunucuda çalıştırır (şehir ve ülke kodunu değiştirerek):
   ```
   sudo bash zeppelin-oracle-setup.sh public-on "Amsterdam" NL
   ```
4. Komutun en sonda yazdığı `https://github.com/LenstedReal/ZeppelinVpn/issues/new?...` bağlantısını açar. Bilgiler doldurulmuş gelir; taahhüt kutularını işaretleyip **Create**'e basar. GitHub hesabı gerekir.

Bağlantıyı kaybederse `sudo bash zeppelin-oracle-setup.sh public-info` aynı bağlantıyı tekrar yazar. Uygulamada da **Kurulum → Sunucunu herkesle paylaş → Listeye öner** butonu formu açar.

## Bot ne yapar?

Başvuru açılınca ya da düzenlenince **Topluluk sunucuları** iş akışı (`.github/workflows/community-server.yml`) çalışır ve başvuruya yorum yazar:

- Sunucu satırının biçimi doğru mu (ad, ülke kodu, adres, anahtar)?
- Adres herkese açık bir IP mi (özel ve yerel adresler reddedilir)?
- Sunucu gerçekten çalışıyor mu? Bot `http://IP:51821/v1/info` adresine sorar. Sunucunun bildirdiği anahtar ve adres öneriyle aynı mı?
- Bu sunucu listede zaten var mı?

Sorun varsa ne olduğunu yazar. Kişi başvuruyu düzenleyince kontrol yeniden çalışır.

## LenstedReal nasıl onaylar?

1. GitHub'dan bildirim gelir. Başvuruyu aç, kimin gönderdiğini ve botun yorumunu oku.
2. Güveniyorsan başvurunun sağındaki **Labels** kısmından **onay** etiketini ekle. Senin işin bu kadar.
3. Bot kontrolü bir kez daha yapar, sunucuyu `servers.json`'a ekler, başvuruya "Eklendi" yazar ve kapatır.

Reddetmek için başvuruyu kapatman yeterli. `onay` etiketini yalnızca repo sahibi ekleyebilir; başka biri eklerse bot bunu geri alır.

İlk başvuru geldiğinde bot `sunucu-onerisi` ve `onay` etiketlerini kendisi oluşturur. Önceden bir şey yapmana gerek yok.

## Sunucu kaldırmak

GitHub'da `servers.json` dosyasını aç, kalem simgesine bas, o sunucunun satırını sil (satırlar arasındaki virgüllere dikkat et) ve **Commit changes** de. Bir sonraki açılışta herkesin listesinden kalkar.

Dosya bozulursa (örneğin bir virgül eksik kalırsa) **Topluluk sunucuları** iş akışı kırmızı X verir. Uygulama bozuk dosyayı kullanmaz, son sağlam listede kalır. Dosyayı düzeltmen yeterli.

## Kendi yeni sunucunu eklemek

Kendi açtığın ikinci, üçüncü sunucu için de aynı yolu izle: `public-on`, bağlantıyı aç, Create, `onay` etiketi. Başvuruyu sen açtığın için sunucu otomatik olarak **İşleten: LenstedReal** olarak eklenir.

## Güvenlik

- Uygulama listeyi yalnızca bu reponun `main` dalındaki `servers.json` dosyasından, HTTPS ile indirir.
- Her sunucunun anahtarı listede sabitlenir. Sunucu başka bir anahtarla cevap verirse uygulama bağlanmaz.
- Uygulamaya gömülü sunucular (Frankfurt) indirilen listeyle değiştirilemez.
- Topluluk sunucusuna ilk bağlanmadan önce uygulama kimin işlettiğini söyler ve onay ister.
- Topluluk sunucusunu işleten kişi, LenstedReal gibi, bağlantıların üst verisini teknik olarak görebilir. Bu yüzden yalnızca tanıdığın ya da güvendiğin kişilerin sunucularını onayla.
