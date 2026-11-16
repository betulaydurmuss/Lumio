// Quizzes for the free courses. `section` is the zero-based section a quiz
// closes; `final` is the course exam that opens once every lesson is done.

interface Side {
  prompt: string;
  options: string[];
  explanation: string;
}

export interface QuestionSeed {
  answer: number;
  tr: Side;
  en: Side;
}

export interface QuizSeed {
  section: number | 'final';
  title: [string, string];
  passPercent?: number;
  questions: QuestionSeed[];
}

export const quizContent: Record<string, QuizSeed[]> = {
  'kvkk-awareness': [
    {
      section: 0,
      title: ['Kavramlar bölüm sınavı', 'Key ideas section quiz'],
      questions: [
        {
          answer: 2,
          tr: {
            prompt: 'Aşağıdakilerden hangisi özel nitelikli kişisel veridir?',
            options: ['Ad soyad', 'İş e-posta adresi', 'Sağlık raporu', 'Doğum yeri'],
            explanation:
              'Sağlık verisi, KVKK m.6’da sayılan özel nitelikli verilerdendir ve daha sıkı korunur.',
          },
          en: {
            prompt: 'Which of these is special category personal data?',
            options: ['Full name', 'Work email address', 'A medical report', 'Place of birth'],
            explanation:
              'Health data is one of the special categories listed in KVKK art. 6 and is protected more strictly.',
          },
        },
        {
          answer: 1,
          tr: {
            prompt: 'Verinin hangi amaçla işleneceğine karar veren kimdir?',
            options: ['Veri işleyen', 'Veri sorumlusu', 'İlgili kişi', 'Kurul'],
            explanation: 'Amacı ve yöntemi belirleyen veri sorumlusudur.',
          },
          en: {
            prompt: 'Who decides what personal data is used for?',
            options: ['The processor', 'The controller', 'The data subject', 'The Board'],
            explanation: 'The controller sets the purpose and the means.',
          },
        },
        {
          answer: 0,
          tr: {
            prompt:
              'Bir bulut sağlayıcısı, şirketin talimatıyla müşteri verilerini saklıyor. Rolü nedir?',
            options: ['Veri işleyen', 'Veri sorumlusu', 'İlgili kişi'],
            explanation: 'Başkası adına ve onun talimatıyla veri işleyen, veri işleyendir.',
          },
          en: {
            prompt:
              'A cloud provider stores customer data on a company’s instructions. What is it?',
            options: ['A processor', 'A controller', 'A data subject'],
            explanation:
              'Whoever processes data on someone else’s behalf and instructions is a processor.',
          },
        },
      ],
    },
    {
      section: 'final',
      title: ['KVKK Farkındalık sınavı', 'KVKK Awareness exam'],
      questions: [
        {
          answer: 1,
          tr: {
            prompt: 'Bir ilgili kişi başvurusu en geç kaç gün içinde sonuçlandırılmalıdır?',
            options: ['7 gün', '30 gün', '60 gün', '90 gün'],
            explanation: 'KVKK m.13’e göre başvuru en geç 30 gün içinde sonuçlandırılır.',
          },
          en: {
            prompt: 'Within how many days must a data subject request be answered?',
            options: ['7 days', '30 days', '60 days', '90 days'],
            explanation: 'Under KVKK art. 13 a request is answered within 30 days at most.',
          },
        },
        {
          answer: 2,
          tr: {
            prompt: 'Kurul’un en sık idari para cezası verdiği yükümlülük hangisidir?',
            options: [
              'Parola politikası',
              'Yedekleme',
              'Aydınlatma yükümlülüğü',
              'Vergi bildirimi',
            ],
            explanation:
              'Veri toplanan her noktada aydınlatma yapılmaması, Kurul kararlarında en sık görülen ihlaldir.',
          },
          en: {
            prompt: 'Which duty does the Board most often fine organizations for?',
            options: ['Password policy', 'Backups', 'The duty to inform', 'Tax filing'],
            explanation:
              'Failing to give a privacy notice wherever data is collected is the breach seen most often in Board decisions.',
          },
        },
        {
          answer: 1,
          tr: {
            prompt: 'Kahve almak için masandan kalkıyorsun. Ne yapmalısın?',
            options: ['Monitörü kapatmak', 'Ekranı kilitlemek', 'Hiçbir şey'],
            explanation: 'Ekranı kilitlemek oturumu korur; monitörü kapatmak korumaz.',
          },
          en: {
            prompt: 'You step away from your desk for a coffee. What should you do?',
            options: ['Switch the monitor off', 'Lock the screen', 'Nothing'],
            explanation: 'Locking protects the session; switching the monitor off does not.',
          },
        },
        {
          answer: 0,
          tr: {
            prompt: 'Önceden işaretlenmiş bir onay kutusuyla alınan rıza geçerli midir?',
            options: [
              'Hayır, rıza açık ve özgür iradeyle verilmelidir',
              'Evet, kullanıcı kutuyu kaldırabilir',
            ],
            explanation: 'Açık rıza, kişinin kendi eylemiyle ve bilgilendirilerek verilmelidir.',
          },
          en: {
            prompt: 'Is consent collected with a pre-ticked box valid?',
            options: [
              'No, consent must be explicit and freely given',
              'Yes, the user can untick it',
            ],
            explanation: 'Explicit consent must come from the person’s own informed action.',
          },
        },
        {
          answer: 2,
          tr: {
            prompt: 'Sana bir veri silme başvurusu geldi. İlk adımın ne olmalı?',
            options: [
              'Veriyi hemen kendim silerim',
              'Başvuruyu yok sayarım',
              'Kurumun başvuru kanalına ve uyum sorumlusuna iletirim',
            ],
            explanation:
              'Başvurular, kurumun belirlediği kanal ve uyum sorumlusu üzerinden yürütülür.',
          },
          en: {
            prompt: 'An erasure request reaches you. What is your first step?',
            options: [
              'Delete the data myself straight away',
              'Ignore the request',
              'Pass it to the organization’s request channel and compliance officer',
            ],
            explanation:
              'Requests go through the channel and the compliance officer the organization set up.',
          },
        },
      ],
    },
  ],
  'password-and-account-security': [
    {
      section: 'final',
      title: ['Parola ve hesap güvenliği sınavı', 'Password and account security exam'],
      questions: [
        {
          answer: 1,
          tr: {
            prompt: 'Bir parolayı en çok ne güçlendirir?',
            options: ['Özel karakterler', 'Uzunluk', 'Büyük harf', 'Her ay değiştirmek'],
            explanation: 'Uzunluk, kırılma süresini en çok artıran etkendir.',
          },
          en: {
            prompt: 'What makes a password strongest?',
            options: ['Special characters', 'Length', 'Capital letters', 'Changing it monthly'],
            explanation: 'Length is what adds the most time to cracking a password.',
          },
        },
        {
          answer: 0,
          tr: {
            prompt: 'Aynı parolayı birden çok sitede kullanmanın asıl riski nedir?',
            options: [
              'Bir sızıntı bütün hesapları açar',
              'Parolayı unutmak',
              'Sitelerin yavaşlaması',
            ],
            explanation: 'Sızan parolalar otomatik olarak başka sitelerde denenir.',
          },
          en: {
            prompt: 'What is the real risk of reusing a password across sites?',
            options: ['One leak opens every account', 'Forgetting it', 'Sites running slower'],
            explanation: 'Leaked passwords are tried automatically on other sites.',
          },
        },
        {
          answer: 2,
          tr: {
            prompt: 'İki adımlı doğrulama neyi sağlar?',
            options: [
              'Parolayı gereksiz kılar',
              'Hesabı daha hızlı açar',
              'Parola çalınsa bile ikinci bir kanıt ister',
            ],
            explanation: 'Saldırgan parolayı bilse de ikinci adımı geçemez.',
          },
          en: {
            prompt: 'What does two-factor authentication do?',
            options: [
              'Makes the password unnecessary',
              'Opens the account faster',
              'Asks for a second proof even if the password is stolen',
            ],
            explanation: 'An attacker who knows the password still cannot pass the second step.',
          },
        },
        {
          answer: 1,
          tr: {
            prompt: 'İş hesabının ele geçirildiğinden şüpheleniyorsun. Ne yaparsın?',
            options: [
              'Kimseye söylemeden parolamı değiştiririm',
              'Parolamı değiştirir ve BT ekibine hemen haber veririm',
              'Bir hafta beklerim',
            ],
            explanation: 'Bir ihlal olabilir; BT ekibinin hemen bilmesi gerekir.',
          },
          en: {
            prompt: 'You suspect your work account was taken over. What do you do?',
            options: [
              'Change my password and tell no one',
              'Change my password and tell IT straight away',
              'Wait a week',
            ],
            explanation: 'It may be a breach, and IT needs to know at once.',
          },
        },
      ],
    },
  ],
  'phishing-and-social-engineering': [
    {
      section: 'final',
      title: ['Oltalama farkındalık sınavı', 'Phishing awareness exam'],
      questions: [
        {
          answer: 2,
          tr: {
            prompt: 'Bir e-postanın gerçek göndericisini en iyi ne gösterir?',
            options: ['Görünen ad', 'Konu satırı', '@ işaretinden sonraki alan adı'],
            explanation: 'Görünen adı herkes yazabilir; alan adı gerçek kaynağı gösterir.',
          },
          en: {
            prompt: 'What best shows who really sent an email?',
            options: ['The display name', 'The subject line', 'The domain after the @ sign'],
            explanation: 'Anyone can type a display name; the domain shows the real source.',
          },
        },
        {
          answer: 0,
          tr: {
            prompt:
              '"24 saat içinde giriş yapmazsanız hesabınız kapanacak" diyen bir e-posta için en doğru tepki?',
            options: [
              'Bağlantıyı kullanmadan bildiğim kanaldan doğrulamak',
              'Hemen bağlantıya tıklamak',
              'E-postayı iş arkadaşlarına iletmek',
            ],
            explanation: 'Aciliyet bir alarmdır; talebi bağımsız bir kanaldan doğrula.',
          },
          en: {
            prompt:
              'An email says "sign in within 24 hours or your account closes". Best response?',
            options: [
              'Confirm through a channel I know, without using the link',
              'Click the link straight away',
              'Forward it to colleagues',
            ],
            explanation: 'Urgency is an alarm; confirm the request through an independent channel.',
          },
        },
        {
          answer: 1,
          tr: {
            prompt: 'Şüpheli bir bağlantıya tıkladın ve parolanı girdin. Ne yaparsın?',
            options: [
              'Kimse fark etmez, unuturum',
              'Hemen bildiririm ve parolamı değiştiririm',
              'Gönderene cevap yazarım',
            ],
            explanation: 'Erken bildirim, ihlalin yayılmasını önler.',
          },
          en: {
            prompt: 'You clicked a suspicious link and typed your password. What do you do?',
            options: [
              'Nobody will notice, so I forget it',
              'Report it at once and change my password',
              'Reply to the sender',
            ],
            explanation: 'Reporting early stops a breach from spreading.',
          },
        },
        {
          answer: 2,
          tr: {
            prompt: 'Genel müdür adına gelen acil bir havale talebi için doğru adım hangisi?',
            options: [
              'Hemen havaleyi yapmak',
              'E-postaya cevap yazıp onaylatmak',
              'Bilinen bir telefon numarasından aramak',
            ],
            explanation:
              'CEO dolandırıcılığında e-postaya cevap da saldırgana gider; bilinen bir kanaldan doğrula.',
          },
          en: {
            prompt: 'An urgent transfer request arrives in the CEO’s name. The right step?',
            options: [
              'Make the transfer at once',
              'Reply to the email to confirm',
              'Call a phone number you already know',
            ],
            explanation:
              'In CEO fraud a reply goes to the attacker too; confirm through a channel you know.',
          },
        },
      ],
    },
  ],
};
