// Demo catalog for local development and the live demo. The people are fictional,
// and the ratings and learner counts are illustrative, not collected from users.

export interface CategorySeed {
  slug: string;
  tr: string;
  en: string;
  children?: CategorySeed[];
}

export const categories: CategorySeed[] = [
  {
    slug: 'web-development',
    tr: 'Web Geliştirme',
    en: 'Web Development',
    children: [
      { slug: 'frontend', tr: 'Ön Yüz', en: 'Frontend' },
      { slug: 'backend', tr: 'Arka Uç', en: 'Backend' },
    ],
  },
  {
    slug: 'cybersecurity',
    tr: 'Siber Güvenlik',
    en: 'Cybersecurity',
    children: [
      { slug: 'application-security', tr: 'Uygulama Güvenliği', en: 'Application Security' },
      { slug: 'security-awareness', tr: 'Güvenlik Farkındalığı', en: 'Security Awareness' },
      { slug: 'network-security', tr: 'Ağ Güvenliği', en: 'Network Security' },
    ],
  },
  {
    slug: 'compliance',
    tr: 'KVKK & Uyum',
    en: 'KVKK & Compliance',
    children: [
      { slug: 'kvkk', tr: 'KVKK', en: 'KVKK' },
      { slug: 'e-commerce-law', tr: 'E-Ticaret Mevzuatı', en: 'E-Commerce Law' },
    ],
  },
];

export interface InstructorSeed {
  slug: string;
  name: string;
  headline: [string, string];
  bio: [string, string];
}

export const instructors: InstructorSeed[] = [
  {
    slug: 'ayse-yilmaz',
    name: 'Ayşe Yılmaz',
    headline: ['Kıdemli Ön Yüz Geliştirici', 'Senior Frontend Developer'],
    bio: [
      'On yılı aşkın süredir erişilebilir ve hızlı web arayüzleri geliştiriyor. Ekiplere tasarım sistemleri kurmayı ve modern CSS kullanmayı öğretiyor.',
      'Has built accessible, fast web interfaces for more than ten years, and teaches teams to set up design systems and use modern CSS.',
    ],
  },
  {
    slug: 'can-ozturk',
    name: 'Can Öztürk',
    headline: ['Arka Uç Mimarı', 'Backend Architect'],
    bio: [
      'Ödeme ve kimlik sistemleri üzerinde çalıştı. Güvenli API tasarımı, veri modelleme ve gözlemlenebilirlik konularında eğitim veriyor.',
      'Has worked on payment and identity systems, and teaches secure API design, data modelling and observability.',
    ],
  },
  {
    slug: 'mert-kaya',
    name: 'Mert Kaya',
    headline: ['Uygulama Güvenliği Uzmanı', 'Application Security Engineer'],
    bio: [
      'Sızma testleri ve güvenli kod incelemeleri yapıyor. Geliştiricilere saldırganın bakış açısını kazandıran uygulamalı eğitimler hazırlıyor.',
      'Runs penetration tests and secure code reviews, and builds hands-on training that shows developers how an attacker thinks.',
    ],
  },
  {
    slug: 'selin-demir',
    name: 'Selin Demir',
    headline: ['KVKK ve Veri Koruma Danışmanı', 'KVKK and Data Protection Consultant'],
    bio: [
      'Şirketlerin KVKK uyum projelerini yürütüyor; aydınlatma metinleri, VERBİS kayıtları ve veri ihlali süreçleri konusunda ekipleri eğitiyor.',
      'Leads KVKK compliance projects for companies and trains teams on privacy notices, VERBIS registration and data breach response.',
    ],
  },
];

/** [type, Turkish title, English title, minutes, free preview] */
export type LessonSeed = ['video' | 'interactive' | 'reading', string, string, number, boolean?];

export interface SectionSeed {
  tr: string;
  en: string;
  lessons: LessonSeed[];
}

export interface CourseSeed {
  slug: string;
  category: string;
  instructor: string;
  title: [string, string];
  subtitle: [string, string];
  description: [string, string];
  outcomes: [string[], string[]];
  requirements: [string[], string[]];
  audience: [string[], string[]];
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  language: 'tr' | 'en';
  price: number;
  listPrice?: number;
  cover: 'a' | 'b' | 'c';
  certificate?: boolean;
  rating: [number, number];
  enrollments: number;
  completions: number;
  publishedDaysAgo: number;
  sections: SectionSeed[];
}

const LEGAL_NOTE_TR =
  'Bu eğitim farkındalık amaçlıdır ve hukuki danışmanlık yerine geçmez. Ceza tutarları her yıl yeniden değerlendirildiği için güncel tutarlar kurs içinde ayrıca belirtilir.';
const LEGAL_NOTE_EN =
  'This course is for awareness and does not replace legal advice. Penalty amounts are revalued every year, so current figures are given separately inside the course.';

export const courses: CourseSeed[] = [
  {
    slug: 'modern-web-with-html-css',
    category: 'frontend',
    instructor: 'ayse-yilmaz',
    title: ['HTML5 ve CSS ile Modern Web', 'Modern Web with HTML5 and CSS'],
    subtitle: [
      'Anlamlı HTML, esnek düzenler ve erişilebilir sayfalar',
      'Meaningful HTML, flexible layouts and accessible pages',
    ],
    description: [
      "Sıfırdan başlayıp gerçek bir kurumsal tanıtım sitesi yapıyoruz. Anlamlı etiketleri, Flexbox ve Grid ile düzen kurmayı, tasarım token'larını ve klavyeyle kullanılabilen arayüzleri adım adım öğreneceksin.",
      'Starting from nothing, we build a real company website. You will learn meaningful markup, layout with Flexbox and Grid, design tokens and interfaces that work with a keyboard, step by step.',
    ],
    outcomes: [
      [
        'Anlamlı ve erişilebilir HTML yazmak',
        'Flexbox ve Grid ile duyarlı düzenler kurmak',
        "CSS değişkenleriyle tasarım token'ları tanımlamak",
        'Sayfayı WCAG kontrast ve klavye kurallarına göre test etmek',
      ],
      [
        'Write meaningful, accessible HTML',
        'Build responsive layouts with Flexbox and Grid',
        'Define design tokens with CSS custom properties',
        'Test a page against WCAG contrast and keyboard rules',
      ],
    ],
    requirements: [
      ['Bir metin editörü ve güncel bir tarayıcı', 'Önceden kodlama bilgisi gerekmez'],
      ['A text editor and an up-to-date browser', 'No previous coding experience'],
    ],
    audience: [
      ['Web geliştirmeye yeni başlayanlar', 'Arayüzünü kendisi düzenlemek isteyen tasarımcılar'],
      ['People new to web development', 'Designers who want to build their own interfaces'],
    ],
    level: 'beginner',
    language: 'tr',
    price: 24900,
    listPrice: 49900,
    cover: 'a',
    rating: [4.8, 1240],
    enrollments: 5320,
    completions: 2810,
    publishedDaysAgo: 220,
    sections: [
      {
        tr: 'Başlarken',
        en: 'Getting started',
        lessons: [
          ['video', 'Web nasıl çalışır?', 'How the web works', 9, true],
          ['video', 'İlk HTML sayfan', 'Your first HTML page', 14, true],
          ['reading', 'Anlamlı etiketler', 'Meaningful elements', 8],
        ],
      },
      {
        tr: 'Düzen ve stil',
        en: 'Layout and style',
        lessons: [
          ['video', 'Kutu modeli', 'The box model', 12],
          ['interactive', 'Flexbox oyun alanı', 'Flexbox playground', 18],
          ['video', 'Grid ile sayfa iskeleti', 'Page structure with Grid', 21],
          ['video', "Tasarım token'ları", 'Design tokens', 15],
        ],
      },
      {
        tr: 'Erişilebilirlik ve yayın',
        en: 'Accessibility and publishing',
        lessons: [
          ['video', 'Klavye ve ekran okuyucu', 'Keyboard and screen readers', 16],
          ['interactive', 'Kontrast denetimi', 'Contrast check', 10],
          ['reading', 'Siteyi yayına almak', 'Publishing the site', 7],
        ],
      },
    ],
  },
  {
    slug: 'javascript-fundamentals',
    category: 'frontend',
    instructor: 'ayse-yilmaz',
    title: ['JavaScript Temelleri', 'JavaScript Fundamentals'],
    subtitle: [
      'Değişkenlerden asenkron koda, tarayıcıda çalışan JavaScript',
      'From variables to async code, JavaScript in the browser',
    ],
    description: [
      "JavaScript'in temel yapı taşlarını küçük, etkileşimli alıştırmalarla öğreniyoruz. Kursun sonunda bir API'den veri çeken ve sayfayı güncelleyen bir uygulama yazmış olacaksın.",
      'We learn the building blocks of JavaScript through small interactive exercises. By the end you will have written an app that fetches data from an API and updates the page.',
    ],
    outcomes: [
      [
        'Değişken, fonksiyon ve dizilerle rahat çalışmak',
        "DOM'u güvenli biçimde güncellemek",
        'fetch ve async/await ile veri almak',
        'Hataları tarayıcı araçlarıyla ayıklamak',
      ],
      [
        'Work comfortably with variables, functions and arrays',
        'Update the DOM safely',
        'Load data with fetch and async/await',
        'Debug with the browser developer tools',
      ],
    ],
    requirements: [['Temel HTML bilgisi'], ['Basic HTML']],
    audience: [
      ["HTML ve CSS'ten sonra bir adım atmak isteyenler"],
      ['Anyone ready for the step after HTML and CSS'],
    ],
    level: 'beginner',
    language: 'tr',
    price: 0,
    cover: 'b',
    rating: [4.7, 2105],
    enrollments: 9870,
    completions: 4120,
    publishedDaysAgo: 400,
    sections: [
      {
        tr: 'Dilin temelleri',
        en: 'Language basics',
        lessons: [
          ['video', 'Değişkenler ve türler', 'Variables and types', 11, true],
          ['interactive', 'Koşullar ve döngüler', 'Conditions and loops', 16],
          ['video', 'Fonksiyonlar', 'Functions', 14],
        ],
      },
      {
        tr: 'Tarayıcıyla konuşmak',
        en: 'Talking to the browser',
        lessons: [
          ['video', 'DOM nedir?', 'What is the DOM?', 10],
          ['interactive', 'Olaylar ve formlar', 'Events and forms', 19],
          ['reading', 'innerHTML neden tehlikeli?', 'Why innerHTML is dangerous', 6],
        ],
      },
      {
        tr: 'Asenkron JavaScript',
        en: 'Asynchronous JavaScript',
        lessons: [
          ['video', 'Promise ve async/await', 'Promises and async/await', 17],
          ['interactive', "Bir API'den veri çekmek", 'Fetching from an API', 22],
        ],
      },
    ],
  },
  {
    slug: 'react-and-typescript',
    category: 'frontend',
    instructor: 'ayse-yilmaz',
    title: [
      'React ve TypeScript ile Arayüz Geliştirme',
      'Building Interfaces with React and TypeScript',
    ],
    subtitle: [
      'Bileşenler, durum yönetimi ve sunucu verisi, uçtan uca tip güvenliğiyle',
      'Components, state and server data, typed end to end',
    ],
    description: [
      'Gerçek bir kurs kataloğu arayüzünü React ve TypeScript ile kuruyoruz. Bileşen tasarımı, form doğrulama, TanStack Query ile sunucu verisi ve yükleniyor, boş ve hata durumlarını ele alıyoruz.',
      'We build a real course catalog interface with React and TypeScript, covering component design, form validation, server data with TanStack Query, and the loading, empty and error states.',
    ],
    outcomes: [
      [
        'Tipli ve yeniden kullanılabilir bileşenler yazmak',
        'Sunucu verisini önbellekle yönetmek',
        'Formları zod ile doğrulamak',
        'Her ekranda yükleniyor, boş ve hata durumunu tasarlamak',
      ],
      [
        'Write typed, reusable components',
        'Manage server data with a cache',
        'Validate forms with zod',
        'Design loading, empty and error states for every screen',
      ],
    ],
    requirements: [
      ['JavaScript temelleri', 'Komut satırına aşinalık'],
      ['JavaScript fundamentals', 'Some comfort with the command line'],
    ],
    audience: [
      ['Arayüz geliştiricileri', "TypeScript'e geçmek isteyen ekipler"],
      ['Frontend developers', 'Teams moving to TypeScript'],
    ],
    level: 'intermediate',
    language: 'en',
    price: 39900,
    cover: 'a',
    rating: [4.9, 640],
    enrollments: 2310,
    completions: 980,
    publishedDaysAgo: 20,
    sections: [
      {
        tr: 'Bileşenler',
        en: 'Components',
        lessons: [
          ['video', "React'te düşünmek", 'Thinking in React', 13, true],
          ['video', 'Prop ve tipler', 'Props and types', 15],
          ['interactive', 'Bir kurs kartı yapmak', 'Building a course card', 20],
        ],
      },
      {
        tr: 'Veri ve durum',
        en: 'Data and state',
        lessons: [
          ['video', 'useState ve useReducer', 'useState and useReducer', 14],
          ['video', 'TanStack Query ile sunucu verisi', 'Server data with TanStack Query', 24],
          ['interactive', 'Filtreler ve URL durumu', 'Filters and URL state', 26],
        ],
      },
      {
        tr: 'Kalite',
        en: 'Quality',
        lessons: [
          ['video', 'zod ile form doğrulama', 'Form validation with zod', 18],
          ['video', 'Erişilebilir bileşenler', 'Accessible components', 16],
          ['reading', 'Test stratejisi', 'A testing strategy', 9],
        ],
      },
    ],
  },
  {
    slug: 'secure-rest-apis-with-node',
    category: 'backend',
    instructor: 'can-ozturk',
    title: ['Node.js ile Güvenli REST API', 'Secure REST APIs with Node.js'],
    subtitle: [
      'Express, zod ve PostgreSQL ile saldırılara dayanıklı bir API',
      'An API that holds up to attackers, with Express, zod and PostgreSQL',
    ],
    description: [
      "Kimlik doğrulama, yetkilendirme, girdi doğrulama ve çok kiracılı veri izolasyonunu içeren bir API'yi baştan sona yazıyoruz. Her konuyu önce bir saldırıyla gösterip sonra düzeltiyoruz.",
      'We write an API end to end with authentication, authorization, input validation and multi-tenant isolation. Each topic starts with an attack, then the fix.',
    ],
    outcomes: [
      [
        'Parolaları argon2 ile saklamak ve oturumları güvenle yönetmek',
        'IDOR ve kiracılar arası sızıntıyı önlemek',
        'Her girdiyi zod ile doğrulamak',
        'CSRF, CORS ve güvenlik başlıklarını doğru kurmak',
      ],
      [
        'Store passwords with argon2 and manage sessions safely',
        'Prevent IDOR and cross-tenant leaks',
        'Validate every input with zod',
        'Set up CSRF, CORS and security headers correctly',
      ],
    ],
    requirements: [
      ['JavaScript veya TypeScript deneyimi', 'Temel SQL bilgisi'],
      ['Experience with JavaScript or TypeScript', 'Basic SQL'],
    ],
    audience: [
      ['Arka uç geliştiricileri', "API'lerin güvenliğinden sorumlu ekip liderleri"],
      ['Backend developers', 'Team leads responsible for API security'],
    ],
    level: 'intermediate',
    language: 'tr',
    price: 44900,
    listPrice: 59900,
    cover: 'b',
    rating: [4.8, 410],
    enrollments: 1870,
    completions: 760,
    publishedDaysAgo: 75,
    sections: [
      {
        tr: 'Temel',
        en: 'Foundations',
        lessons: [
          ['video', "Bir API'yi nasıl saldırırlar?", 'How APIs get attacked', 12, true],
          ['video', 'Express ve zod ile iskelet', 'A skeleton with Express and zod', 18],
        ],
      },
      {
        tr: 'Kimlik ve oturum',
        en: 'Identity and sessions',
        lessons: [
          ['video', 'argon2 ve hesap kilitleme', 'argon2 and account lockout', 16],
          ['video', 'Refresh token rotasyonu', 'Refresh token rotation', 19],
          ['interactive', 'TOTP ile iki adımlı doğrulama', 'Two-factor with TOTP', 21],
        ],
      },
      {
        tr: 'Yetki ve izolasyon',
        en: 'Authorization and isolation',
        lessons: [
          ['video', 'IDOR: başkasının kaydına erişmek', "IDOR: reaching someone else's record", 14],
          ['video', 'Satır bazlı çok kiracılık', 'Row-level multi-tenancy', 22],
          ['reading', 'Denetim kaydı tasarlamak', 'Designing an audit log', 10],
        ],
      },
    ],
  },
  {
    slug: 'owasp-top-10-in-practice',
    category: 'application-security',
    instructor: 'mert-kaya',
    title: ['Uygulamalı OWASP Top 10', 'OWASP Top 10 in Practice'],
    subtitle: [
      'En yaygın web açıklarını bul, sömür ve kapat',
      'Find, exploit and close the most common web flaws',
    ],
    description: [
      'Kasıtlı olarak açık bırakılmış bir eğitim uygulaması üzerinde OWASP Top 10 kategorilerini tek tek inceliyoruz. Her açığın nasıl bulunduğunu, neden oluştuğunu ve kodda nasıl düzeltildiğini görüyoruz.',
      'On a deliberately vulnerable training app we go through the OWASP Top 10 one by one: how each flaw is found, why it happens and how it is fixed in code.',
    ],
    outcomes: [
      [
        'Erişim kontrolü hatalarını tanımak',
        "SQL enjeksiyonu ve XSS'i önlemek",
        'SSRF ve güvensiz yapılandırmayı tespit etmek',
        'Bulguları önem derecesine göre raporlamak',
      ],
      [
        'Recognise broken access control',
        'Prevent SQL injection and XSS',
        'Spot SSRF and insecure configuration',
        'Report findings by severity',
      ],
    ],
    requirements: [
      ['Web uygulamalarının nasıl çalıştığına dair temel bilgi'],
      ['A basic understanding of how web apps work'],
    ],
    audience: [
      ['Geliştiriciler, test uzmanları ve güvenliğe ilgi duyanlar'],
      ['Developers, testers and anyone curious about security'],
    ],
    level: 'intermediate',
    language: 'tr',
    price: 34900,
    cover: 'b',
    rating: [4.9, 880],
    enrollments: 3650,
    completions: 1540,
    publishedDaysAgo: 150,
    sections: [
      {
        tr: 'Laboratuvarı kurmak',
        en: 'Setting up the lab',
        lessons: [
          ['video', 'Yasal ve etik çerçeve', 'The legal and ethical frame', 8, true],
          ['video', 'Eğitim uygulamasını çalıştırmak', 'Running the training app', 10],
        ],
      },
      {
        tr: 'Erişim ve enjeksiyon',
        en: 'Access and injection',
        lessons: [
          ['video', 'Bozuk erişim kontrolü', 'Broken access control', 19],
          ['interactive', 'SQL enjeksiyonu laboratuvarı', 'SQL injection lab', 25],
          ['interactive', 'XSS laboratuvarı', 'XSS lab', 23],
        ],
      },
      {
        tr: 'Yapılandırma ve sunucu tarafı',
        en: 'Configuration and server side',
        lessons: [
          ['video', 'Güvenlik yanlış yapılandırması', 'Security misconfiguration', 14],
          ['interactive', 'SSRF laboratuvarı', 'SSRF lab', 20],
          ['reading', 'Bulgu raporu yazmak', 'Writing a findings report', 9],
        ],
      },
    ],
  },
  {
    slug: 'phishing-and-social-engineering',
    category: 'security-awareness',
    instructor: 'mert-kaya',
    title: ['Oltalama ve Sosyal Mühendislik', 'Phishing and Social Engineering'],
    subtitle: [
      'Sahte e-postayı, aramayı ve mesajı ilk bakışta tanı',
      'Spot the fake email, call or message at first glance',
    ],
    description: [
      'Gerçek vakalardan örneklerle oltalama e-postalarını, sahte faturaları, CEO dolandırıcılığını ve telefonla yapılan sosyal mühendisliği inceliyoruz. Şüpheli bir durumu kime ve nasıl bildireceğini öğreniyorsun.',
      'With examples from real cases we look at phishing emails, fake invoices, CEO fraud and social engineering over the phone, and you learn who to report a suspicious message to, and how.',
    ],
    outcomes: [
      [
        'Oltalama e-postasının işaretlerini tanımak',
        'Bağlantıyı açmadan gerçek adresi kontrol etmek',
        'Telefon ve SMS dolandırıcılığına karşı doğru soruyu sormak',
        'Şüpheli durumu doğru kanaldan bildirmek',
      ],
      [
        'Recognise the signs of a phishing email',
        "Check a link's real address without opening it",
        'Ask the right question against phone and SMS fraud',
        'Report a suspicious message through the right channel',
      ],
    ],
    requirements: [['Gerekmez'], ['None']],
    audience: [
      ['Tüm çalışanlar', 'KVKK m.12 kapsamında farkındalık eğitimi vermesi gereken kurumlar'],
      ['All employees', 'Organizations that must provide awareness training under KVKK art. 12'],
    ],
    level: 'all',
    language: 'tr',
    price: 0,
    cover: 'b',
    rating: [4.9, 3120],
    enrollments: 14200,
    completions: 11800,
    publishedDaysAgo: 300,
    sections: [
      {
        tr: 'Oltalama',
        en: 'Phishing',
        lessons: [
          ['video', 'Bir oltalama e-postasının anatomisi', 'Anatomy of a phishing email', 9, true],
          ['interactive', 'Gerçek mi, sahte mi?', 'Real or fake?', 12],
          ['video', 'Sahte giriş sayfaları', 'Fake sign-in pages', 7],
        ],
      },
      {
        tr: 'Sosyal mühendislik',
        en: 'Social engineering',
        lessons: [
          ['video', 'CEO dolandırıcılığı', 'CEO fraud', 8],
          ['video', 'Telefon ve SMS ile saldırılar', 'Attacks by phone and SMS', 9],
        ],
      },
      {
        tr: 'Ne yapmalı?',
        en: 'What to do',
        lessons: [
          ['interactive', 'Bildirme alıştırması', 'Reporting drill', 6],
          ['reading', 'Kontrol listesi', 'Checklist', 4],
        ],
      },
    ],
  },
  {
    slug: 'password-and-account-security',
    category: 'security-awareness',
    instructor: 'mert-kaya',
    title: ['Parola ve Hesap Güvenliği', 'Password and Account Security'],
    subtitle: [
      'Güçlü parola, parola yöneticisi ve iki adımlı doğrulama',
      'Strong passwords, password managers and two-factor authentication',
    ],
    description: [
      'Parolaların nasıl ele geçirildiğini ve bunu önlemenin en pratik yollarını anlatıyoruz. Kursun sonunda bir parola yöneticisi kurmuş ve hesaplarında iki adımlı doğrulamayı açmış olacaksın.',
      'We explain how passwords get stolen and the most practical ways to stop it. By the end you will have set up a password manager and turned on two-factor authentication on your accounts.',
    ],
    outcomes: [
      [
        'Uzun ve benzersiz parolalar oluşturmak',
        'Bir parola yöneticisi kullanmak',
        'İki adımlı doğrulamayı açmak',
        'Ele geçirilmiş bir hesabı fark edip kurtarmak',
      ],
      [
        'Create long, unique passwords',
        'Use a password manager',
        'Turn on two-factor authentication',
        'Notice and recover a compromised account',
      ],
    ],
    requirements: [['Gerekmez'], ['None']],
    audience: [['Tüm çalışanlar'], ['All employees']],
    level: 'beginner',
    language: 'tr',
    price: 0,
    cover: 'b',
    rating: [4.7, 1980],
    enrollments: 10400,
    completions: 9100,
    publishedDaysAgo: 30,
    sections: [
      {
        tr: 'Parolalar',
        en: 'Passwords',
        lessons: [
          ['video', 'Parolalar nasıl çalınır?', 'How passwords get stolen', 7, true],
          ['interactive', 'Güçlü parola oluşturmak', 'Making a strong password', 8],
          ['video', 'Parola yöneticileri', 'Password managers', 9],
        ],
      },
      {
        tr: 'Hesabını koru',
        en: 'Protect your account',
        lessons: [
          ['video', 'İki adımlı doğrulama', 'Two-factor authentication', 8],
          ['reading', 'Hesabın ele geçirildiyse', 'If your account was taken over', 5],
        ],
      },
    ],
  },
  {
    slug: 'network-security-fundamentals',
    category: 'network-security',
    instructor: 'can-ozturk',
    title: ['Ağ Güvenliği Temelleri', 'Network Security Fundamentals'],
    subtitle: [
      'TCP/IP, TLS, güvenlik duvarları ve güvenli uzaktan çalışma',
      'TCP/IP, TLS, firewalls and working remotely without the risk',
    ],
    description: [
      'Bir ağın nasıl çalıştığını ve trafiğin nerede korunması gerektiğini sade bir dille anlatıyoruz. TLS, DNS, güvenlik duvarı kuralları, VPN ve halka açık Wi-Fi riskleri kursun ana başlıkları.',
      'A plain-language look at how a network works and where its traffic needs protecting: TLS, DNS, firewall rules, VPNs and the risks of public Wi-Fi.',
    ],
    outcomes: [
      [
        'Bir paketin ağda izlediği yolu açıklamak',
        "TLS'in neyi koruduğunu ve neyi korumadığını bilmek",
        'Temel güvenlik duvarı kuralları yazmak',
        'Uzaktan çalışırken güvenli bağlantı kurmak',
      ],
      [
        'Explain the path a packet takes',
        'Know what TLS protects and what it does not',
        'Write basic firewall rules',
        'Connect safely when working remotely',
      ],
    ],
    requirements: [['Temel bilgisayar kullanımı'], ['Everyday computer use']],
    audience: [
      ['BT ekipleri ve sistem yöneticiliğine giriş yapanlar'],
      ['IT teams and people starting out in system administration'],
    ],
    level: 'intermediate',
    language: 'en',
    price: 29900,
    cover: 'a',
    rating: [4.6, 350],
    enrollments: 1420,
    completions: 610,
    publishedDaysAgo: 190,
    sections: [
      {
        tr: 'Ağın temelleri',
        en: 'Network basics',
        lessons: [
          ['video', 'TCP/IP katmanları', 'The TCP/IP layers', 15, true],
          ['video', 'DNS ve riskleri', 'DNS and its risks', 13],
        ],
      },
      {
        tr: 'Trafiği korumak',
        en: 'Protecting traffic',
        lessons: [
          ['video', 'TLS nasıl çalışır?', 'How TLS works', 17],
          ['interactive', 'Güvenlik duvarı kuralları', 'Firewall rules', 22],
          ['video', 'VPN ve halka açık Wi-Fi', 'VPNs and public Wi-Fi', 12],
        ],
      },
    ],
  },
  {
    slug: 'kvkk-awareness',
    category: 'kvkk',
    instructor: 'selin-demir',
    title: ['KVKK Farkındalık Eğitimi', 'KVKK Awareness Training'],
    subtitle: [
      'Her çalışanın bilmesi gereken kişisel veri kuralları',
      'The personal data rules every employee needs to know',
    ],
    description: [
      `6698 sayılı Kanun'un temel kavramlarını günlük iş örnekleriyle anlatıyoruz: kişisel veri ve özel nitelikli veri, veri sorumlusu ve veri işleyen, işleme şartları, aydınlatma ve ilgili kişinin hakları. ${LEGAL_NOTE_TR}`,
      `The core ideas of Law No. 6698 through everyday examples at work: personal and special category data, controller and processor, the grounds for processing, privacy notices and the rights of the data subject. ${LEGAL_NOTE_EN}`,
    ],
    outcomes: [
      [
        'Kişisel veriyi ve özel nitelikli veriyi ayırt etmek',
        'Veri sorumlusu ve veri işleyen rollerini bilmek',
        'İşleme şartlarını (m.5-6) tanımak',
        'Temiz masa ve güvenli paylaşım kurallarını uygulamak',
      ],
      [
        'Tell personal data from special category data',
        'Know the controller and processor roles',
        'Recognise the grounds for processing (art. 5-6)',
        'Apply clean desk and safe sharing rules',
      ],
    ],
    requirements: [['Gerekmez'], ['None']],
    audience: [
      ['Tüm çalışanlar (yıllık tekrar önerilir)'],
      ['All employees (yearly refresher recommended)'],
    ],
    level: 'all',
    language: 'tr',
    price: 0,
    cover: 'c',
    rating: [4.7, 4210],
    enrollments: 18600,
    completions: 15900,
    publishedDaysAgo: 360,
    sections: [
      {
        tr: 'Kavramlar',
        en: 'Key ideas',
        lessons: [
          ['video', 'Kişisel veri nedir?', 'What is personal data?', 8, true],
          ['video', 'Özel nitelikli veriler', 'Special category data', 7],
          ['interactive', 'Rolleri eşleştir', 'Match the roles', 6],
        ],
      },
      {
        tr: 'İşleme ve aydınlatma',
        en: 'Processing and notice',
        lessons: [
          ['video', 'İşleme şartları', 'Grounds for processing', 10],
          ['video', 'Aydınlatma yükümlülüğü', 'The duty to inform', 9],
          ['reading', 'İlgili kişinin hakları', 'Rights of the data subject', 6],
        ],
      },
      {
        tr: 'Günlük işte KVKK',
        en: 'KVKK in daily work',
        lessons: [
          ['interactive', 'Temiz masa, temiz ekran', 'Clean desk, clean screen', 5],
          ['video', 'Veriyi güvenle paylaşmak', 'Sharing data safely', 7],
        ],
      },
    ],
  },
  {
    slug: 'kvkk-privacy-notice-and-consent',
    category: 'kvkk',
    instructor: 'selin-demir',
    title: ['Aydınlatma Yükümlülüğü ve Açık Rıza', 'Privacy Notices and Explicit Consent'],
    subtitle: [
      'Doğru metin, doğru yerde: form, üyelik ve çerez akışları',
      'The right text in the right place: forms, sign-ups and cookies',
    ],
    description: [
      `Kurul'un en sık ceza verdiği alan olan aydınlatma yükümlülüğünü ve açık rızanın geçerlilik koşullarını inceliyoruz. Çerez banner'ı, üyelik formu ve pazarlama izni için uygulanabilir şablonlar hazırlıyoruz. ${LEGAL_NOTE_TR}`,
      `We look at the duty to inform, the area the Board fines most often, and at when explicit consent is valid. We prepare workable templates for a cookie banner, a sign-up form and marketing permission. ${LEGAL_NOTE_EN}`,
    ],
    outcomes: [
      [
        'Aydınlatma metninin zorunlu unsurlarını yazmak',
        'Açık rıza ile diğer işleme şartlarını ayırt etmek',
        'Önceden işaretli kutu gibi geçersiz rıza tasarımlarından kaçınmak',
        'Çerezleri zorunlu, analitik ve pazarlama olarak sınıflandırmak',
      ],
      [
        'Write the required parts of a privacy notice',
        'Tell explicit consent from the other grounds',
        'Avoid invalid consent designs such as pre-ticked boxes',
        'Classify cookies as necessary, analytics or marketing',
      ],
    ],
    requirements: [['KVKK Farkındalık Eğitimi önerilir'], ['KVKK Awareness Training recommended']],
    audience: [
      ['Pazarlama, ürün ve web ekipleri', 'Uyum sorumluları'],
      ['Marketing, product and web teams', 'Compliance officers'],
    ],
    level: 'intermediate',
    language: 'tr',
    price: 19900,
    cover: 'c',
    rating: [4.8, 520],
    enrollments: 2240,
    completions: 1630,
    publishedDaysAgo: 12,
    sections: [
      {
        tr: 'Aydınlatma',
        en: 'Privacy notices',
        lessons: [
          ['video', 'Aydınlatma metninin unsurları', 'What a privacy notice must say', 11, true],
          ['interactive', 'Eksik metni tamamla', 'Complete the notice', 9],
        ],
      },
      {
        tr: 'Açık rıza',
        en: 'Explicit consent',
        lessons: [
          ['video', 'Ne zaman rıza gerekir?', 'When consent is needed', 10],
          ['video', 'Geçersiz rıza örnekleri', 'Examples of invalid consent', 8],
        ],
      },
      {
        tr: 'Çerezler',
        en: 'Cookies',
        lessons: [
          ['video', 'Kurul Çerez Rehberi', "The Board's cookie guidance", 9],
          ['interactive', 'Banner tasarla', 'Design a banner', 12],
        ],
      },
    ],
  },
  {
    slug: 'kvkk-data-breach-72-hours',
    category: 'kvkk',
    instructor: 'selin-demir',
    title: ['Veri İhlali ve 72 Saat Kuralı', 'Data Breach Response and the 72-Hour Rule'],
    subtitle: [
      'Tespitten Kurul bildirimine kadar olay müdahale akışı',
      'The incident response flow from detection to notifying the Board',
    ],
    description: [
      `KVKK m.12/5 kapsamında bir veri ihlalinin nasıl tespit edileceğini, ilk 72 saatte kimin ne yapacağını, Kurul'a ve ilgili kişilere bildirimin nasıl hazırlanacağını tatbikatlarla çalışıyoruz. ${LEGAL_NOTE_TR}`,
      `Through drills we work on how a breach is detected under KVKK art. 12/5, who does what in the first 72 hours, and how the notices to the Board and to the people affected are prepared. ${LEGAL_NOTE_EN}`,
    ],
    outcomes: [
      [
        'Bir olayın veri ihlali olup olmadığına karar vermek',
        '72 saatlik bildirim takvimini işletmek',
        'Kurul bildirim formunu hazırlamak',
        'Olay sonrası kök neden analizi yapmak',
      ],
      [
        'Decide whether an incident is a data breach',
        'Run the 72-hour notification timeline',
        'Prepare the Board notification form',
        'Carry out a root cause analysis afterwards',
      ],
    ],
    requirements: [
      ['KVKK temelleri', 'Kurumunun BT yapısına genel aşinalık'],
      ['KVKK fundamentals', "A general familiarity with your organization's IT"],
    ],
    audience: [
      ['BT ve güvenlik ekipleri', 'Yöneticiler ve uyum sorumluları'],
      ['IT and security teams', 'Managers and compliance officers'],
    ],
    level: 'advanced',
    language: 'tr',
    price: 24900,
    cover: 'c',
    rating: [4.9, 260],
    enrollments: 980,
    completions: 640,
    publishedDaysAgo: 95,
    sections: [
      {
        tr: 'İhlali tanımak',
        en: 'Recognising a breach',
        lessons: [
          ['video', 'Olay mı, ihlal mi?', 'Incident or breach?', 10, true],
          ['reading', 'Yasal çerçeve', 'The legal frame', 8],
        ],
      },
      {
        tr: 'İlk 72 saat',
        en: 'The first 72 hours',
        lessons: [
          ['video', 'Müdahale ekibi ve roller', 'The response team and its roles', 12],
          ['interactive', 'Tatbikat: fidye yazılımı', 'Drill: ransomware', 25],
          ['video', 'Kurula bildirim', 'Notifying the Board', 14],
          ['video', 'İlgili kişilere bildirim', 'Notifying the people affected', 9],
        ],
      },
      {
        tr: 'Sonrası',
        en: 'Afterwards',
        lessons: [['reading', 'Kök neden ve iyileştirme', 'Root cause and remediation', 10]],
      },
    ],
  },
  {
    slug: 'e-commerce-compliance',
    category: 'e-commerce-law',
    instructor: 'selin-demir',
    title: [
      'E-Ticaret Mevzuatı: ETBİS, İYS ve Mesafeli Satış',
      'E-Commerce Law: ETBIS, IYS and Distance Sales',
    ],
    subtitle: [
      'Online satış yapan bir sitenin yayına girmeden önce tamamlaması gerekenler',
      'What a site that sells online has to settle before it goes live',
    ],
    description: [
      `ETBİS kaydı, ticari elektronik ileti ve İYS onay akışı, ön bilgilendirme formu, mesafeli satış sözleşmesi ve 14 günlük cayma hakkını bir kontrol listesi üzerinden işliyoruz. ${LEGAL_NOTE_TR}`,
      `We work through a checklist: ETBIS registration, commercial messages and the IYS consent flow, the pre-information form, the distance sales contract and the 14-day right of withdrawal. ${LEGAL_NOTE_EN}`,
    ],
    outcomes: [
      [
        'ETBİS kaydının kimler için zorunlu olduğunu bilmek',
        'Pazarlama iletileri için İYS uyumlu onay toplamak',
        'Ön bilgilendirme ve mesafeli satış metinlerini hazırlamak',
        'Cayma hakkı sürecini doğru işletmek',
      ],
      [
        'Know who must register with ETBIS',
        'Collect IYS-compliant consent for marketing messages',
        'Prepare the pre-information and distance sales texts',
        'Run the right of withdrawal correctly',
      ],
    ],
    requirements: [['Gerekmez'], ['None']],
    audience: [
      ['E-ticaret sitesi sahipleri', 'Pazarlama ve müşteri hizmetleri ekipleri'],
      ['Online shop owners', 'Marketing and customer service teams'],
    ],
    level: 'intermediate',
    language: 'tr',
    price: 29900,
    cover: 'c',
    certificate: true,
    rating: [4.6, 190],
    enrollments: 760,
    completions: 410,
    publishedDaysAgo: 60,
    sections: [
      {
        tr: 'Kayıtlar',
        en: 'Registrations',
        lessons: [
          ['video', 'ETBİS kaydı', 'ETBIS registration', 9, true],
          ['video', 'İYS ve ticari ileti onayı', 'IYS and consent for commercial messages', 12],
        ],
      },
      {
        tr: 'Satış süreci',
        en: 'The sale',
        lessons: [
          ['video', 'Ön bilgilendirme formu', 'The pre-information form', 10],
          ['video', 'Mesafeli satış sözleşmesi', 'The distance sales contract', 11],
          ['interactive', 'Cayma hakkı senaryoları', 'Right of withdrawal scenarios', 14],
        ],
      },
      {
        tr: 'Kontrol listesi',
        en: 'Checklist',
        lessons: [['reading', 'Yayına girmeden önce', 'Before going live', 6]],
      },
    ],
  },
];
