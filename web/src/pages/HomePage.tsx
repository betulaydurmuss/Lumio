import { BadgeCheck, Building2, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const pillars = [
  { key: 'learn', Icon: PlayCircle },
  { key: 'prove', Icon: BadgeCheck },
  { key: 'comply', Icon: Building2 },
] as const;

export function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="pill">{t('home.pill')}</span>
          <h1>{t('home.title')}</h1>
          <p>{t('home.lead')}</p>
          <div className="actions">
            <Link to="/courses" className="btn btn-accent btn-lg">
              {t('home.browse')}
            </Link>
            <Link to="/business" className="btn btn-secondary btn-lg">
              {t('home.forTeams')}
            </Link>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap pillars">
          {pillars.map(({ key, Icon }) => (
            <article key={key} className="card">
              <span className="pillar-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h3>{t(`home.pillars.${key}.title`)}</h3>
              <p>{t(`home.pillars.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
