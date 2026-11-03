/** Oracle Cloud server guide shown in the "Server" tab (TR/EN). */

export interface Localized {
  tr: string;
  en: string;
}

export interface GuideStep {
  title: Localized;
  body: Localized;
  commands?: string[];
  /** Shows the "copy setup command" button (the embedded server script). */
  install?: boolean;
  /** Shows the "open Android VPN settings" button. */
  alwaysOn?: boolean;
  /** Shows the "propose to the list" button (GitHub issue form). */
  share?: boolean;
}

export const STEPS: GuideStep[] = [
  {
    title: { tr: 'Oracle hesabı aç', en: 'Create an Oracle account' },
    body: {
      tr: 'oracle.com/cloud/free adresinde “Start for free” ile kaydol. Kart doğrulaması istenir; Always Free kaynaklar ücretlendirilmez. Ana bölge (Home Region) sonradan değiştirilemez ve ücretsiz sunucu yalnızca orada açılabilir: sana yakın bir Avrupa bölgesi seç (ör. Frankfurt, Amsterdam, Milano).',
      en: 'Sign up with “Start for free” at oracle.com/cloud/free. A card check is required; Always Free resources are not charged. The Home Region cannot be changed later and free servers can only be created there: pick a region close to you.',
    },
  },
  {
    title: { tr: 'SSH anahtarı oluştur (Termux)', en: 'Create an SSH key (Termux)' },
    body: {
      tr: 'Termux’u F-Droid’den ya da GitHub’dan kur (Play Store sürümü eskidir). Sonra bu komutları sırayla çalıştır. Son komutun yazdığı “ssh-ed25519 …” satırının tamamını kopyala; 4. adımda yapıştıracaksın.',
      en: 'Install Termux from F-Droid or GitHub (the Play Store version is outdated). Run these commands one by one. Copy the whole “ssh-ed25519 …” line printed by the last one; you will paste it in step 4.',
    },
    commands: ['pkg update -y && pkg install -y openssh', 'ssh-keygen -t ed25519 -f ~/.ssh/oracle -N ""', 'cat ~/.ssh/oracle.pub'],
  },
  {
    title: { tr: 'Ağı oluştur (VCN)', en: 'Create the network (VCN)' },
    body: {
      tr: 'Oracle konsolu: Menü ☰ → Networking → Virtual cloud networks → “Start VCN Wizard” → “Create VCN with Internet Connectivity” → bir ad ver → Next → Create. Ayarların varsayılanı doğrudur.',
      en: 'Oracle console: menu ☰ → Networking → Virtual cloud networks → “Start VCN Wizard” → “Create VCN with Internet Connectivity” → give it a name → Next → Create. The defaults are right.',
    },
  },
  {
    title: { tr: 'Sunucuyu oluştur', en: 'Create the server' },
    body: {
      tr: 'Menü ☰ → Compute → Instances → Create instance.\n• Image: Canonical Ubuntu 24.04\n• Shape: VM.Standard.E2.1.Micro (Always Free). Kapasite varsa Ampere VM.Standard.A1.Flex (1 OCPU, 6 GB) daha hızlıdır.\n• Networking: 3. adımdaki VCN ve onun “public subnet”i; “Assign a public IPv4 address” açık.\n• Add SSH keys: “Paste public keys” → 2. adımda kopyaladığın satırı yapıştır.\nCreate’e bas, durum RUNNING olunca “Public IP address” değerini not et.',
      en: 'Menu ☰ → Compute → Instances → Create instance.\n• Image: Canonical Ubuntu 24.04\n• Shape: VM.Standard.E2.1.Micro (Always Free). If capacity allows, Ampere VM.Standard.A1.Flex (1 OCPU, 6 GB) is faster.\n• Networking: the VCN from step 3 and its public subnet; “Assign a public IPv4 address” on.\n• Add SSH keys: “Paste public keys” → paste the line from step 2.\nPress Create; when the state is RUNNING, note the “Public IP address”.',
    },
  },
  {
    title: { tr: 'UDP 51820 kapısını aç', en: 'Open UDP port 51820' },
    body: {
      tr: 'Sunucu sayfasında Subnet bağlantısı → Security Lists → Default Security List → “Add Ingress Rules”:\n• Source CIDR: 0.0.0.0/0\n• IP Protocol: UDP (TCP değil!)\n• Destination Port Range: 51820\nBu kural olmadan uygulama “Sunucudan yanıt yok” der. Sunucunun içindeki güvenlik duvarını kurulum betiği ayarlar.',
      en: 'On the server page: the Subnet link → Security Lists → Default Security List → “Add Ingress Rules”:\n• Source CIDR: 0.0.0.0/0\n• IP Protocol: UDP (not TCP!)\n• Destination Port Range: 51820\nWithout this rule the app says “No response from the server”. The firewall inside the server is handled by the setup script.',
    },
  },
  {
    title: { tr: 'Sunucuya bağlan (Termux)', en: 'Connect to the server (Termux)' },
    body: {
      tr: 'SUNUCU_IP yerine 4. adımdaki Public IP’yi yaz. İlk bağlantıda sorulan soruya “yes” de.',
      en: 'Replace SUNUCU_IP with the Public IP from step 4. Answer “yes” to the first-time question.',
    },
    commands: ['ssh -i ~/.ssh/oracle ubuntu@SUNUCU_IP'],
  },
  {
    title: { tr: 'Tek komutla kur', en: 'Install with one command' },
    body: {
      tr: '“Kurulum komutunu kopyala”ya dokun, SSH oturumuna yapıştır (Termux’ta uzun bas → Paste) ve Enter’a bas. Komut betiği yazar, bütünlüğünü sha256 ile doğrular ve çalıştırır. 1–5 dakika sürer; yeni açılan sunucuda Ubuntu güncellemeleri bitene kadar bekleyebilir. Sonunda profil metni BEGIN/END satırları arasında görünür.',
      en: 'Tap “Copy the setup command”, paste it into the SSH session (long-press in Termux → Paste) and press Enter. It writes the script, checks it with sha256 and runs it. It takes 1–5 minutes; on a fresh server it may wait for Ubuntu updates first. At the end the profile text appears between BEGIN/END lines.',
    },
    install: true,
  },
  {
    title: { tr: 'Profili uygulamaya ekle', en: 'Add the profile to the app' },
    body: {
      tr: 'Termux’ta ekrana uzun bas → “Select” → “# Name:” satırından “PersistentKeepalive = 25” satırına kadar seç → Copy. Sonra Sunucular → “Panodan yapıştır” → Kaydet. Metni tekrar görmek için sunucuda:',
      en: 'In Termux long-press → “Select” → select from the “# Name:” line to “PersistentKeepalive = 25” → Copy. Then Servers → “Paste from clipboard” → Save. To see the text again, run on the server:',
    },
    commands: ['sudo bash zeppelin-oracle-setup.sh show telefon'],
  },
  {
    title: { tr: 'Bağlan ve doğrula', en: 'Connect and verify' },
    body: {
      tr: 'Bağlantı sekmesinde BAĞLAN’a bas ve Android’in VPN iznini onayla. “Korunuyorsun” yazmalı ve “Çıkış IP” Oracle sunucunun Public IP’si olmalı.',
      en: 'Press CONNECT on the Connect tab and accept Android’s VPN prompt. It should say “Protected” and the “Exit IP” should be your Oracle server’s Public IP.',
    },
  },
  {
    title: { tr: 'Sunucunu herkesle paylaş (isteğe bağlı)', en: 'Share your server with everyone (optional)' },
    body: {
      tr: 'Sunucun uygulamadaki listeye girerse herkes tek dokunuşla bağlanabilir. Önce Oracle Security List’e TCP 51821 giriş kuralı ekle. Sonra sunucuda aşağıdaki komutu çalıştır (şehir adını ve ülke kodunu değiştir). Komutun yazdığı GitHub bağlantısını aç ve “Create”e bas (GitHub hesabı gerekir). Bir bot sunucunun çalıştığını kontrol eder; LenstedReal onaylayınca sunucun herkesin listesinde “Topluluk” etiketiyle görünür. Her cihaz kendi anahtarını alır, en fazla 150 cihaz, 14 gün kullanılmayan cihazlar silinir. Unutma: bağlanan herkes senin sunucunun IP’siyle internete çıkar.',
      en: 'If your server gets into the app’s list, anyone can connect with one tap. First add a TCP 51821 ingress rule to the Oracle Security List. Then run the command below on the server (change the city and country code). Open the GitHub link it prints and tap “Create” (needs a GitHub account). A bot checks that the server works; once LenstedReal approves, your server appears in everyone’s list with a “Community” label. Each device gets its own key, at most 150 devices, devices unused for 14 days are removed. Keep in mind: everyone who connects browses with your server’s IP.',
    },
    commands: ['sudo bash zeppelin-oracle-setup.sh public-on "Amsterdam" NL'],
    share: true,
  },
  {
    title: { tr: 'Tam koruma (önerilir)', en: 'Full protection (recommended)' },
    body: {
      tr: 'Android ayarlarında Zeppelin VPN için “Her zaman açık VPN” ve “VPN olmadan bağlantıları engelle”yi aç. Telefon açılırken veya uygulama güncellenirken bile trafik sızmaz.',
      en: 'In Android settings turn on “Always-on VPN” and “Block connections without VPN” for Zeppelin VPN. Then nothing leaks even while the phone boots or the app updates.',
    },
    alwaysOn: true,
  },
];

export const NOTES: Localized[] = [
  {
    tr: 'E2.1.Micro: 1/8 OCPU, 1 GB RAM ve yaklaşık 50 Mbps internet. Gezinme, mesajlaşma ve video için yeterli; daha hızlısı A1.Flex.',
    en: 'E2.1.Micro: 1/8 OCPU, 1 GB RAM and about 50 Mbps internet. Enough for browsing, messaging and video; A1.Flex is faster.',
  },
  {
    tr: 'Ayda 10 TB dışarı giden veri ücretsizdir.',
    en: '10 TB of outbound data per month is free.',
  },
  {
    tr: 'Oracle, 7 gün boyunca CPU, ağ ve (A1’de) bellek kullanımı çok düşük kalan Always Free sunucuları geri alabilir. Keepalive bunu engellemez. Sunucuyu düzenli kullan ya da hesabı “Pay As You Go”ya yükselt (Always Free kaynaklar yine ücretsiz kalır).',
    en: 'Oracle may reclaim Always Free servers whose CPU, network and (on A1) memory use stay very low for 7 days. Keepalive does not prevent this. Use the server regularly or upgrade the account to “Pay As You Go” (Always Free resources stay free).',
  },
  {
    tr: 'Her cihaz kendi profilini kullanmalı. Yeni cihaz için sunucuda: sudo bash zeppelin-oracle-setup.sh add tablet',
    en: 'Every device should use its own profile. For a new device run on the server: sudo bash zeppelin-oracle-setup.sh add tablet',
  },
  {
    tr: 'Kendi sunucun gizlilik sağlar ama anonimlik sağlamaz: çıkış IP’si Oracle hesabına bağlıdır.',
    en: 'Your own server gives privacy, not anonymity: the exit IP is tied to your Oracle account.',
  },
];

export interface Trouble {
  q: Localized;
  a: Localized;
  command?: string;
}

export const TROUBLE: Trouble[] = [
  {
    q: { tr: '“Bağlanıyor…”da kalıyor / Sunucudan yanıt yok', en: 'Stuck on “Connecting…” / No response from the server' },
    a: {
      tr: 'En sık neden Security List’te UDP 51820 kuralının olmaması (5. adım). Sonra sunucuda durumu kontrol et:',
      en: 'The most common cause is a missing UDP 51820 rule in the Security List (step 5). Then check the server:',
    },
    command: 'sudo bash zeppelin-oracle-setup.sh status',
  },
  {
    q: { tr: '“Korunuyorsun” ama sayfalar açılmıyor', en: '“Protected” but pages do not load' },
    a: {
      tr: 'El sıkışma çalışıyor ama sunucu trafiği internete yönlendirmiyor. Kuralları yeniden uygula:',
      en: 'The handshake works but the server is not forwarding traffic. Re-apply the rules:',
    },
    command: 'sudo bash zeppelin-oracle-setup.sh repair',
  },
  {
    q: { tr: 'Bazı siteler ya da uygulamalar takılıyor', en: 'Some sites or apps hang' },
    a: {
      tr: 'Ayarlar → MTU → 1280 seçip yeniden bağlan.',
      en: 'Settings → MTU → choose 1280 and reconnect.',
    },
  },
  {
    q: { tr: 'SSH: “Permission denied (publickey)”', en: 'SSH: “Permission denied (publickey)”' },
    a: {
      tr: 'Kullanıcı adı ubuntu olmalı ve -i ~/.ssh/oracle ile 2. adımdaki anahtarı vermelisin. Sunucuyu oluştururken yapıştırdığın anahtarın bu olduğundan emin ol.',
      en: 'The user name must be ubuntu and you must pass the key from step 2 with -i ~/.ssh/oracle. Make sure that is the key you pasted when creating the server.',
    },
  },
  {
    q: { tr: 'SSH: “Connection timed out”', en: 'SSH: “Connection timed out”' },
    a: {
      tr: 'IP adresini ve sunucunun RUNNING olduğunu kontrol et. VCN sihirbazı TCP 22 kuralını kendisi ekler; sildiysen geri ekle.',
      en: 'Check the IP address and that the server is RUNNING. The VCN wizard adds the TCP 22 rule itself; add it back if you removed it.',
    },
  },
  {
    q: { tr: 'A1.Flex için “Out of capacity”', en: '“Out of capacity” for A1.Flex' },
    a: {
      tr: 'E2.1.Micro seç ya da daha sonra tekrar dene.',
      en: 'Choose E2.1.Micro or try again later.',
    },
  },
];

export const SCRIPT_COMMANDS: { command: string; desc: Localized }[] = [
  { command: 'sudo bash zeppelin-oracle-setup.sh status', desc: { tr: 'Sağlık kontrolü ve çözüm önerileri', en: 'Health check with fixes' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh add tablet', desc: { tr: 'Yeni cihaz için profil', en: 'Profile for a new device' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh show telefon', desc: { tr: 'Profili tekrar göster', en: 'Show a profile again' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh list', desc: { tr: 'Profiller ve son el sıkışmaları', en: 'Profiles and their last handshake' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh remove tablet', desc: { tr: 'Profili iptal et', en: 'Revoke a profile' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh repair', desc: { tr: 'Yönlendirme ve güvenlik duvarını onar', en: 'Repair forwarding and firewall' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh public-info', desc: { tr: 'Sunucu satırını ve öneri bağlantısını tekrar göster', en: 'Show the server line and the proposal link again' } },
  { command: 'sudo bash zeppelin-oracle-setup.sh public-off', desc: { tr: 'Hazır sunucu modunu kapat', en: 'Turn off ready-server mode' } },
];
