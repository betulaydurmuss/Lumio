import { PRIVACY_NOTICE_VERSION } from '@lumio/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

interface Section {
  heading: string;
  body?: string;
  items?: string[];
}

/**
 * The privacy notice (KVKK aydınlatma metni). Kept as structured text in both
 * languages; it describes what the code actually does, and its version is the
 * one every consent is recorded against.
 */
const notice: Record<'tr' | 'en', { title: string; intro: string; sections: Section[] }> = {
  tr: {
    title: 'Kişisel verilerin korunması aydınlatma metni',
    intro:
      "Bu metin, Lumio'yu kullanırken hangi kişisel verilerinin hangi amaçla işlendiğini 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi uyarınca açıklar. Veri sorumlusu, bu Lumio kurulumunu işleten kuruluştur.",
    sections: [
      {
        heading: 'İşlenen veriler',
        items: [
          'Kimlik ve iletişim: ad soyad, e-posta adresi, kurum adı, rol ve dil tercihi.',
          'Öğrenme kayıtları: kayıt olunan kurslar, ders ilerlemesi, sınav sonuçları, kurum atamaları ve verilen sertifikalar.',
          'Güvenlik kayıtları: oturumların açıldığı cihaz bilgisi ve IP adresi, giriş denemeleri ve denetim kaydı.',
          'İzinler: pazarlama e-postası iznin ve bu iznin geçmişi.',
        ],
      },
      {
        heading: 'Amaçlar ve hukuki sebepler',
        items: [
          'Hesabını açmak, eğitimleri sunmak ve sertifika düzenlemek: sözleşmenin kurulması ve ifası (m.5/2-c).',
          'Hesabını ve platformu korumak, denetim kaydı tutmak: hukuki yükümlülük ve meşru menfaat (m.5/2-ç, m.5/2-f).',
          'Kurumunun sana atadığı eğitimleri ve ilerlemeni kuruma raporlamak: kurumunla olan iş ilişkisi kapsamında meşru menfaat (m.5/2-f).',
          'Kampanya ve yenilik e-postaları göndermek: yalnızca açık rızanla (m.5/1). Rıza vermemek hiçbir hizmeti kısıtlamaz ve her an geri alınabilir.',
        ],
      },
      {
        heading: 'Aktarım',
        body: 'Veriler satılmaz ve reklam amacıyla paylaşılmaz. Kurumsal hesaplarda öğrenme kayıtların bağlı olduğun kurumun yöneticileriyle paylaşılır. Bir kurum, başka bir kurumun verisini göremez.',
      },
      {
        heading: 'Çerezler',
        body: 'Yalnızca zorunlu çerezler kullanılır: oturum ve güvenlik (CSRF) çerezleri. Analitik ya da reklam çerezi yoktur. Dil ve video hızı gibi tercihler yalnızca tarayıcında saklanır.',
      },
      {
        heading: 'Saklama',
        body: 'Hesap verileri hesap açık kaldığı sürece saklanır. Sertifikaların doğrulanabilir kalması için sertifika kayıtları ve denetim kayıtları, ilgili mevzuatın öngördüğü süre boyunca tutulur.',
      },
      {
        heading: 'Hakların (KVKK m.11)',
        items: [
          'Verilerinin işlenip işlenmediğini öğrenmek ve bilgi istemek: Hesabım sayfasındaki "Verilerimi indir" ile tüm kayıtlarını tek dosyada alabilirsin.',
          'Eksik ya da yanlış verinin düzeltilmesini, koşulları varsa silinmesini istemek.',
          'İşlemenin amacını ve aktarıldığı kişileri öğrenmek; otomatik işlemeye itiraz etmek; zarar halinde tazminat istemek.',
          'Başvurularını kurulumu işleten kuruluşun KVKK başvuru kanalına iletebilirsin.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy notice',
    intro:
      'This notice explains which personal data Lumio processes and why, as required by article 10 of the Turkish Personal Data Protection Law No. 6698 (KVKK). The data controller is the organization that operates this Lumio installation.',
    sections: [
      {
        heading: 'Data processed',
        items: [
          'Identity and contact: name, email address, organization, role and language.',
          'Learning records: enrolled courses, lesson progress, quiz results, assignments from your organization and certificates issued.',
          'Security records: the device and IP address of each session, sign-in attempts and the audit log.',
          'Consents: your marketing email consent and its history.',
        ],
      },
      {
        heading: 'Purposes and legal grounds',
        items: [
          'Opening your account, providing courses and issuing certificates: performance of a contract (art. 5/2-c).',
          'Protecting your account and the platform, keeping an audit log: legal obligation and legitimate interest (art. 5/2-ç, 5/2-f).',
          'Reporting assigned training and your progress to your organization: legitimate interest within your working relationship (art. 5/2-f).',
          'Sending news and offers by email: only with your explicit consent (art. 5/1). Saying no limits nothing, and you can withdraw at any time.',
        ],
      },
      {
        heading: 'Sharing',
        body: 'Data is never sold or shared for advertising. In company accounts, your learning records are shared with the admins of your organization. No organization can see another organization’s data.',
      },
      {
        heading: 'Cookies',
        body: 'Only strictly necessary cookies are used: the session and security (CSRF) cookies. There are no analytics or advertising cookies. Preferences such as language and video speed stay in your browser.',
      },
      {
        heading: 'Retention',
        body: 'Account data is kept while the account is open. Certificate and audit records are kept for the period the law requires, so that certificates stay verifiable.',
      },
      {
        heading: 'Your rights (KVKK art. 11)',
        items: [
          'To learn whether your data is processed and to ask about it: "Download my data" on your account page gives you every record in one file.',
          'To have incomplete or wrong data corrected, and deleted where the conditions are met.',
          'To learn the purpose and recipients, to object to automated decisions, and to claim damages.',
          'Send requests to the KVKK contact of the organization that operates this installation.',
        ],
      },
    ],
  },
};

export function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const text = notice[i18n.resolvedLanguage === 'en' ? 'en' : 'tr'];
  return (
    <div className="wrap page prose">
      <div className="page-head">
        <h2>{text.title}</h2>
        <p className="hint">{t('privacy.version', { version: PRIVACY_NOTICE_VERSION })}</p>
      </div>
      <p>{text.intro}</p>
      {text.sections.map((section) => (
        <section key={section.heading}>
          <h3>{section.heading}</h3>
          {section.body && <p>{section.body}</p>}
          {section.items && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p>
        <Link to="/account">{t('privacy.manage')}</Link>
      </p>
    </div>
  );
}
