import { BadgeCheck, Building2, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMe } from '../api/auth.js';
import { useCatalog, useLearning } from '../api/catalog.js';
import { CourseCard, CourseCardSkeleton } from '../components/CourseCard.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { SearchBox } from '../components/SearchBox.js';

const pillars = [
  { key: 'learn', Icon: PlayCircle },
  { key: 'prove', Icon: BadgeCheck },
  { key: 'comply', Icon: Building2 },
] as const;

const popularParams = new URLSearchParams({ sort: 'popular' });

function ContinueRail() {
  const { t } = useTranslation();
  const signedIn = Boolean(useMe().data);
  const learning = useLearning(signedIn);
  if (!signedIn || !learning.data?.length) return null;

  return (
    <section className="section rail">
      <div className="wrap">
        <h3 className="section-title">{t('homeRails.continue')}</h3>
        <div className="catalog-grid">
          {learning.data.slice(0, 4).map((item) => (
            <CourseCard key={item.course.slug} course={item.course} enrolled />
          ))}
        </div>
      </div>
    </section>
  );
}

function PopularRail() {
  const { t } = useTranslation();
  const popular = useCatalog(popularParams);
  return (
    <section className="section rail">
      <div className="wrap">
        <div className="rail-head">
          <h3 className="section-title">{t('homeRails.popular')}</h3>
          <Link to="/courses">{t('homeRails.seeAll')} →</Link>
        </div>
        {popular.isError && <ErrorAlert error={popular.error} />}
        <div className="catalog-grid">
          {popular.isPending &&
            Array.from({ length: 4 }, (_, index) => <CourseCardSkeleton key={index} />)}
          {popular.data?.items.slice(0, 4).map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="pill">{t('home.pill')}</span>
          <h1>{t('home.title')}</h1>
          <p>{t('home.lead')}</p>
          <div className="hero-search">
            <SearchBox size="lg" />
          </div>
          <div className="actions">
            <Link to="/courses" className="btn btn-accent btn-lg">
              {t('home.browse')}
            </Link>
            <Link to="/sign-up?type=company" className="btn btn-secondary btn-lg">
              {t('home.forTeams')}
            </Link>
          </div>
        </div>
      </section>
      <ContinueRail />
      <PopularRail />
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
