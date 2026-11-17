import { learningStatsSchema } from '@lumio/shared';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpenCheck, Clock, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../api/catalog.js';
import { api } from '../api/client.js';

function hours(minutes: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60);
}

/** Time, streak and the past week, for a learner who has started something. */
export function LearningStats({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => api('GET', '/api/me/stats', { schema: learningStatsSchema }),
    enabled,
    retry: false,
  });
  if (!enabled || !stats.data || stats.data.lessonsCompleted === 0) return null;

  const { data } = stats;
  const busiest = Math.max(1, ...data.week.map((day) => day.minutes));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const tiles = [
    { Icon: Clock, label: t('stats.hours'), value: hours(data.minutesLearned, locale) },
    {
      Icon: Flame,
      label: t('stats.streak'),
      value: t('stats.days', { count: data.streak.current }),
    },
    { Icon: BookOpenCheck, label: t('stats.lessons'), value: String(data.lessonsCompleted) },
    { Icon: Award, label: t('stats.certificates'), value: String(data.certificates) },
  ];

  return (
    <section className="section rail" aria-labelledby="stats-title">
      <div className="wrap">
        <h3 id="stats-title" className="section-title">
          {t('stats.title')}
        </h3>
        <div className="stats-strip">
          <dl className="stats-tiles">
            {tiles.map(({ Icon, label, value }) => (
              <div key={label} className="card">
                <dt>
                  <Icon size={16} aria-hidden="true" /> {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <figure className="card week">
            <figcaption>
              {t('stats.week')}{' '}
              <span className="hint">{t('stats.longest', { count: data.streak.longest })}</span>
            </figcaption>
            <ol>
              {data.week.map((day) => (
                <li key={day.date}>
                  <span
                    className="bar"
                    style={{ height: `${Math.round((day.minutes / busiest) * 100)}%` }}
                    title={t('stats.minutes', { count: day.minutes })}
                  />
                  <span className="day">{weekday.format(new Date(`${day.date}T12:00:00`))}</span>
                  <span className="sr-only">{t('stats.minutes', { count: day.minutes })}</span>
                </li>
              ))}
            </ol>
          </figure>
        </div>
      </div>
    </section>
  );
}
