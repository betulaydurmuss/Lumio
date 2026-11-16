import type { LessonBody } from '@lumio/shared';

// Written content for the free courses, keyed by course slug and the lesson's
// English title. Lessons without an entry show a "being prepared" state.

type Bilingual = { tr: LessonBody; en: LessonBody };

export const lessonContent: Record<string, Record<string, Bilingual>> = {
  'kvkk-awareness': {
    'Match the roles': {
      tr: {
        kind: 'interactive',
        steps: [
          {
            title: 'Veri sorumlusu',
            body: 'Kişisel verilerin hangi amaçla ve nasıl işleneceğine karar veren kişi ya da kurumdur. Bir şirket, çalışanlarının bordro verileri için veri sorumlusudur.',
            check: {
              question:
                'Bir şirket maaş bordrolarını bir muhasebe firmasına hazırlatıyor. Bordro verilerinin hangi amaçla işleneceğine kim karar verir?',
              options: ['Muhasebe firması', 'Şirket', 'Çalışan'],
              answer: 1,
              explanation:
                'Amacı ve yöntemi belirleyen şirkettir; bu yüzden veri sorumlusu şirkettir.',
            },
          },
          {
            title: 'Veri işleyen',
            body: 'Veri sorumlusunun verdiği yetkiye dayanarak, onun adına kişisel veri işleyen kişi ya da kurumdur. Kendi amacı için veri kullanamaz.',
            check: {
              question: 'Aynı örnekte muhasebe firmasının rolü nedir?',
              options: ['Veri sorumlusu', 'Veri işleyen', 'İlgili kişi'],
              answer: 1,
              explanation:
                'Firma, şirketin talimatıyla ve onun adına çalışır; bu yüzden veri işleyendir.',
            },
          },
          {
            title: 'İlgili kişi',
            body: 'Kişisel verisi işlenen gerçek kişidir: çalışan, müşteri, ziyaretçi ya da aday. Kanun ona bilgi isteme, düzeltme ve silme gibi haklar tanır.',
            check: {
              question: 'Bordrosu hazırlanan çalışan hangi roldedir?',
              options: ['İlgili kişi', 'Veri işleyen', 'Veri sorumlusu'],
              answer: 0,
              explanation:
                "Verisi işlenen gerçek kişi ilgili kişidir ve KVKK m.11'deki haklara sahiptir.",
            },
          },
        ],
      },
      en: {
        kind: 'interactive',
        steps: [
          {
            title: 'Data controller',
            body: 'The person or organization that decides why and how personal data is processed. A company is the controller of its employees’ payroll data.',
            check: {
              question:
                'A company has an accounting firm prepare its payslips. Who decides what the payroll data is used for?',
              options: ['The accounting firm', 'The company', 'The employee'],
              answer: 1,
              explanation:
                'The company sets the purpose and the means, so the company is the controller.',
            },
          },
          {
            title: 'Data processor',
            body: 'The person or organization that processes personal data on the controller’s behalf and on its instructions. It may not use the data for its own purposes.',
            check: {
              question: 'In the same example, what is the accounting firm?',
              options: ['Data controller', 'Data processor', 'Data subject'],
              answer: 1,
              explanation:
                'The firm works on the company’s instructions and on its behalf, so it is a processor.',
            },
          },
          {
            title: 'Data subject',
            body: 'The living person whose data is processed: an employee, customer, visitor or applicant. The law gives them rights such as access, correction and erasure.',
            check: {
              question: 'What is the employee whose payslip is prepared?',
              options: ['Data subject', 'Data processor', 'Data controller'],
              answer: 0,
              explanation:
                'The person whose data is processed is the data subject, with the rights in KVKK art. 11.',
            },
          },
        ],
      },
    },
    'Rights of the data subject': {
      tr: {
        kind: 'reading',
        blocks: [
          { type: 'heading', text: "KVKK m.11'e göre ilgili kişinin hakları" },
          {
            type: 'paragraph',
            text: 'Kişisel verisi işlenen herkes, veri sorumlusuna başvurarak aşağıdaki hakları kullanabilir. Bu başvurular çoğu zaman müşteri hizmetlerine ya da insan kaynaklarına gelir; bu yüzden her çalışanın bu hakları tanıması gerekir.',
          },
          {
            type: 'list',
            items: [
              'Kişisel verisinin işlenip işlenmediğini öğrenmek',
              'İşlenmişse buna ilişkin bilgi istemek',
              'İşlenme amacını ve verinin bu amaca uygun kullanılıp kullanılmadığını öğrenmek',
              'Verinin yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilmek',
              'Eksik ya da yanlış işlenmişse düzeltilmesini istemek',
              'Kanunun öngördüğü şartlarla silinmesini veya yok edilmesini istemek',
              'Düzeltme ve silme işlemlerinin, verinin aktarıldığı üçüncü kişilere bildirilmesini istemek',
              'Yalnızca otomatik sistemlerle yapılan bir analizin aleyhine sonuç doğurmasına itiraz etmek',
              'Kanuna aykırı işleme nedeniyle zarara uğradıysa zararın giderilmesini istemek',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'Veri sorumlusu başvuruyu en geç 30 gün içinde ve kural olarak ücretsiz sonuçlandırmalıdır (KVKK m.13). Süresinde cevaplanmayan başvuru, Kurul’a şikâyet yolunu açar.',
          },
          {
            type: 'paragraph',
            text: 'Sana böyle bir başvuru gelirse kendin cevaplamaya çalışma; kurumunun belirlediği başvuru kanalına ve uyum sorumlusuna hemen ilet.',
          },
        ],
      },
      en: {
        kind: 'reading',
        blocks: [
          { type: 'heading', text: 'The rights of the data subject under KVKK art. 11' },
          {
            type: 'paragraph',
            text: 'Anyone whose personal data is processed can apply to the controller to use the rights below. These requests often reach customer service or HR first, so every employee should recognise them.',
          },
          {
            type: 'list',
            items: [
              'Learn whether their personal data is processed',
              'Ask for information about it if it is',
              'Learn the purpose of processing and whether the data is used for that purpose',
              'Know the third parties in Türkiye or abroad the data was transferred to',
              'Ask for incomplete or incorrect data to be corrected',
              'Ask for the data to be erased or destroyed under the conditions in the law',
              'Ask for corrections and erasures to be passed on to the third parties who received the data',
              'Object to a result against them that comes only from automated analysis',
              'Claim compensation for damage caused by unlawful processing',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'The controller must answer within 30 days and, as a rule, free of charge (KVKK art. 13). A request left unanswered opens the way to a complaint to the Board.',
          },
          {
            type: 'paragraph',
            text: 'If such a request reaches you, do not try to answer it yourself; pass it straight to your organization’s request channel and its compliance officer.',
          },
        ],
      },
    },
    'Clean desk, clean screen': {
      tr: {
        kind: 'interactive',
        steps: [
          {
            title: 'Ekranını kilitle',
            body: 'Masandan kısa süreliğine bile kalksan ekranını kilitle. Windows’ta Windows + L, macOS’ta Control + Command + Q yeterlidir.',
            check: {
              question: 'Kahve almak için iki dakikalığına masandan kalkıyorsun. Ne yaparsın?',
              options: [
                'Ekranı açık bırakırım',
                'Ekranı kilitlerim',
                'Yalnızca monitörü kapatırım',
              ],
              answer: 1,
              explanation:
                'Monitörü kapatmak oturumu açık bırakır; ekranı kilitlemek iki saniye sürer ve veriyi korur.',
            },
          },
          {
            title: 'Masada belge bırakma',
            body: 'Kişisel veri içeren çıktılar işin bitince kilitli dolaba kaldırılmalı ya da imha makinesinden geçirilmelidir.',
            check: {
              question: 'Müşteri listesinin çıktısıyla işin bitti. Şimdi ne olmalı?',
              options: [
                'Yarın lazım olur, masada kalsın',
                'Kilitli dolaba kaldırılmalı ya da imha edilmeli',
                'Çöp kutusuna atılmalı',
              ],
              answer: 1,
              explanation:
                'Çöpe atılan çıktılar okunabilir kalır. Ya kilit altına al ya da imha makinesinden geçir.',
            },
          },
          {
            title: 'Ortak yazıcı',
            body: 'Yazdırdığın belgeyi hemen al. Yazıcıda unutulan bir bordro ya da müşteri listesi, en sık rastlanan küçük ihlallerden biridir.',
          },
        ],
      },
      en: {
        kind: 'interactive',
        steps: [
          {
            title: 'Lock your screen',
            body: 'Lock your screen even if you step away for a moment. Windows + L on Windows, Control + Command + Q on macOS.',
            check: {
              question: 'You step away for two minutes to get a coffee. What do you do?',
              options: ['Leave the screen open', 'Lock the screen', 'Only switch the monitor off'],
              answer: 1,
              explanation:
                'Switching the monitor off leaves the session open; locking takes two seconds and protects the data.',
            },
          },
          {
            title: 'No papers left on the desk',
            body: 'Printouts with personal data should go into a locked cabinet or through the shredder once you are done.',
            check: {
              question: 'You have finished with a printed customer list. What happens to it now?',
              options: [
                'Leave it on the desk for tomorrow',
                'Lock it away or shred it',
                'Put it in the bin',
              ],
              answer: 1,
              explanation: 'Paper in the bin can still be read. Lock it away or shred it.',
            },
          },
          {
            title: 'The shared printer',
            body: 'Collect what you print straight away. A payslip or customer list forgotten on the printer is one of the most common small breaches.',
          },
        ],
      },
    },
  },
  'password-and-account-security': {
    'Making a strong password': {
      tr: {
        kind: 'interactive',
        steps: [
          {
            title: 'Uzunluk karmaşıklıktan önemlidir',
            body: 'Saldırganlar kısa parolaları dakikalar içinde dener. Birbiriyle ilgisiz dört-beş kelimeden oluşan uzun bir parola, hem hatırlaması kolay hem de tahmin etmesi zordur.',
            check: {
              question: 'Hangisi daha güçlü bir paroladır?',
              options: ['Lumio2026!', 'mavi-bisiklet-kahve-pencere', 'P@ss1'],
              answer: 1,
              explanation:
                'Uzunluk en önemli etkendir. Dört rastgele kelime, kısa ve "karmaşık görünen" parolalardan çok daha zor kırılır.',
            },
          },
          {
            title: 'Her hesaba ayrı parola',
            body: 'Bir sitede sızan parola, saldırganlar tarafından başka sitelerde de denenir. Buna "credential stuffing" denir.',
            check: {
              question:
                'İş e-postanla aynı parolayı bir alışveriş sitesinde kullandın ve o site sızdırıldı. Risk nedir?',
              options: [
                'Sadece alışveriş hesabım etkilenir',
                'Aynı parolayla iş e-postama da girilebilir',
                'Hiçbir risk yok',
              ],
              answer: 1,
              explanation:
                'Sızan parolalar otomatik olarak başka servislerde denenir. Her hesaba ayrı parola bu zinciri kırar.',
            },
          },
          {
            title: 'Parola yöneticisi kullan',
            body: 'Onlarca benzersiz parolayı ezberlemek mümkün değil. Bir parola yöneticisi hepsini şifreli olarak saklar; sen yalnızca tek bir güçlü ana parolayı hatırlarsın.',
          },
        ],
      },
      en: {
        kind: 'interactive',
        steps: [
          {
            title: 'Length beats complexity',
            body: 'Attackers try short passwords in minutes. A long password made of four or five unrelated words is easy to remember and hard to guess.',
            check: {
              question: 'Which is the stronger password?',
              options: ['Lumio2026!', 'blue-bicycle-coffee-window', 'P@ss1'],
              answer: 1,
              explanation:
                'Length matters most. Four random words are far harder to crack than short passwords that only look complex.',
            },
          },
          {
            title: 'One password per account',
            body: 'A password leaked from one site is tried on other sites. This is called credential stuffing.',
            check: {
              question:
                'You used your work email password on a shopping site, and that site was breached. What is the risk?',
              options: [
                'Only my shopping account is affected',
                'My work email can be opened with the same password',
                'There is no risk',
              ],
              answer: 1,
              explanation:
                'Leaked passwords are tried automatically on other services. A different password for each account breaks the chain.',
            },
          },
          {
            title: 'Use a password manager',
            body: 'Nobody can remember dozens of unique passwords. A password manager stores them encrypted, and you only remember one strong master password.',
          },
        ],
      },
    },
    'If your account was taken over': {
      tr: {
        kind: 'reading',
        blocks: [
          { type: 'heading', text: 'Hesabının ele geçirildiğinden şüpheleniyorsan' },
          {
            type: 'paragraph',
            text: 'Tanımadığın bir giriş bildirimi, gönderilmiş gibi görünen e-postalar ya da değişmiş ayarlar bir işaret olabilir. Hızlı davranmak zararı küçültür.',
          },
          {
            type: 'list',
            items: [
              'Parolanı hemen, başka bir cihazdan değiştir',
              'Bütün açık oturumları kapat',
              'İki adımlı doğrulamayı aç ya da yeniden kur',
              'Aynı parolayı kullandığın diğer hesapların parolalarını da değiştir',
              'E-posta yönlendirme ve kurtarma ayarlarını kontrol et',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'Hesap bir iş hesabıysa kendi başına çözmeye çalışma; BT ya da güvenlik ekibine hemen haber ver. Bir veri ihlali olabilir ve 72 saatlik bildirim süresi işlemeye başlamış olabilir.',
          },
        ],
      },
      en: {
        kind: 'reading',
        blocks: [
          { type: 'heading', text: 'If you think your account was taken over' },
          {
            type: 'paragraph',
            text: 'A sign-in alert you do not recognise, emails that look sent by you, or changed settings can all be signs. Acting quickly limits the damage.',
          },
          {
            type: 'list',
            items: [
              'Change your password straight away, from another device',
              'Sign out every open session',
              'Turn on two-factor authentication, or set it up again',
              'Change the password on any other account that used the same one',
              'Check email forwarding and recovery settings',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'If it is a work account, do not try to fix it alone; tell IT or the security team at once. It may be a data breach, and the 72-hour notification clock may already be running.',
          },
        ],
      },
    },
  },
  'phishing-and-social-engineering': {
    'Real or fake?': {
      tr: {
        kind: 'interactive',
        steps: [
          {
            title: 'Gönderen adresine bak',
            body: 'Görünen ad herkes tarafından yazılabilir. Asıl adres, @ işaretinden sonraki alan adıdır. Benzer ama farklı alan adlarına dikkat et.',
            check: {
              question:
                'Bankandan geldiğini söyleyen bir e-posta "guvenlik@bankam-destek.co" adresinden gelmiş. Ne düşünürsün?',
              options: [
                'Bankanın adı geçtiği için güvenilirdir',
                'Alan adı bankanınkiyle aynı değil, şüphelidir',
                'Adreste "guvenlik" yazdığı için resmidir',
              ],
              answer: 1,
              explanation:
                'Saldırganlar gerçeğine benzeyen alan adları alır. Bankanın kendi alan adı değilse e-postaya güvenme.',
            },
          },
          {
            title: 'Aciliyet bir alarmdır',
            body: '"Hesabınız 24 saat içinde kapatılacak" gibi baskı kuran ifadeler, düşünmeden tıklamanı sağlamak için kullanılır.',
            check: {
              question: 'E-posta "Hemen giriş yapmazsanız maaşınız yatmayacak" diyor. Ne yaparsın?',
              options: [
                'Bağlantıya tıklayıp giriş yaparım',
                'Bağlantıyı kullanmadan, bildiğim kanaldan İK’yı ararım',
                'E-postayı iş arkadaşlarıma iletirim',
              ],
              answer: 1,
              explanation:
                'Şüpheli bir talebi her zaman bildiğin, bağımsız bir kanaldan doğrula; e-postadaki bağlantıyı ya da numarayı kullanma.',
            },
          },
          {
            title: 'Bağlantının gerçek adresi',
            body: 'Bağlantının üzerine tıklamadan fareyle gelirsen, tarayıcı gerçek adresi alt köşede gösterir. Metin ile adres farklıysa tıklama.',
          },
        ],
      },
      en: {
        kind: 'interactive',
        steps: [
          {
            title: 'Look at the sender address',
            body: 'Anyone can type a display name. The real address is the domain after the @ sign. Watch for domains that look alike but are not the same.',
            check: {
              question:
                'An email that says it is from your bank comes from "security@mybank-support.co". What do you think?',
              options: [
                'It mentions the bank, so it is trustworthy',
                'The domain is not the bank’s own, so it is suspicious',
                'The address says "security", so it is official',
              ],
              answer: 1,
              explanation:
                'Attackers register domains that look like the real one. If it is not the bank’s own domain, do not trust the email.',
            },
          },
          {
            title: 'Urgency is an alarm',
            body: 'Pressure such as "your account will be closed within 24 hours" is used to make you click without thinking.',
            check: {
              question:
                'The email says "sign in now or your salary will not be paid". What do you do?',
              options: [
                'Click the link and sign in',
                'Call HR through a channel I already know, without using the link',
                'Forward the email to colleagues',
              ],
              answer: 1,
              explanation:
                'Always confirm a suspicious request through an independent channel you know; never use the link or number in the email.',
            },
          },
          {
            title: 'The real address of a link',
            body: 'Hover over a link without clicking and the browser shows the real address in the corner. If the text and the address differ, do not click.',
          },
        ],
      },
    },
    'Reporting drill': {
      tr: {
        kind: 'interactive',
        steps: [
          {
            title: 'Bildirmek suçlamak değildir',
            body: 'Şüpheli bir e-postayı bildiren çalışan, saldırıyı herkes için durdurabilir. Yanlış alarm vermekten çekinme; güvenlik ekibi bunu tercih eder.',
            check: {
              question: 'Oltalama olduğundan emin değilsin. Ne yaparsın?',
              options: [
                'Emin olmadığım için bir şey yapmam',
                'Kurumumun bildirme butonu ya da adresiyle bildiririm',
                'Gönderene cevap yazıp kim olduğunu sorarım',
              ],
              answer: 1,
              explanation:
                'Şüphe yeterli bir sebeptir. Gönderene cevap yazmak ise adresinin aktif olduğunu saldırgana gösterir.',
            },
          },
          {
            title: 'Bağlantıya tıkladıysan',
            body: 'Tıkladın ya da bilgi girdiysen saklama: hemen bildir ve girdiğin parolayı değiştir. Erken bildirim, ihlalin yayılmasını önler.',
          },
        ],
      },
      en: {
        kind: 'interactive',
        steps: [
          {
            title: 'Reporting is not blaming',
            body: 'An employee who reports a suspicious email can stop the attack for everyone. Do not worry about a false alarm; the security team would rather have it.',
            check: {
              question: 'You are not sure the email is phishing. What do you do?',
              options: [
                'Nothing, since I am not sure',
                'Report it with my organization’s report button or address',
                'Reply and ask the sender who they are',
              ],
              answer: 1,
              explanation:
                'Doubt is reason enough. Replying only tells the attacker your address is active.',
            },
          },
          {
            title: 'If you already clicked',
            body: 'If you clicked or entered details, do not hide it: report it straight away and change the password you typed. Reporting early stops a breach from spreading.',
          },
        ],
      },
    },
    Checklist: {
      tr: {
        kind: 'reading',
        blocks: [
          { type: 'heading', text: 'Tıklamadan önce beş soru' },
          {
            type: 'list',
            items: [
              'Gönderenin alan adı gerçekten tanıdığım kurumun mu?',
              'E-posta beni acele etmeye ya da korkutmaya mı çalışıyor?',
              'Bağlantının gerçek adresi, metinde yazanla aynı mı?',
              'Benden parola, kart ya da kimlik bilgisi mi istiyor?',
              'Beklemediğim bir ek mi var?',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'Bir soruya bile "evet, şüpheli" diyorsan tıklama ve bildir.',
          },
        ],
      },
      en: {
        kind: 'reading',
        blocks: [
          { type: 'heading', text: 'Five questions before you click' },
          {
            type: 'list',
            items: [
              'Is the sender’s domain really the organization I know?',
              'Is the email trying to rush or frighten me?',
              'Does the link’s real address match its text?',
              'Is it asking for a password, card or ID details?',
              'Is there an attachment I did not expect?',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'If even one answer is "yes, that is suspicious", do not click; report it.',
          },
        ],
      },
    },
  },
};
