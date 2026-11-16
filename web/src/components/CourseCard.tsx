import type { CourseCard as Course } from '@lumio/shared';
import { Clock, Play, Star, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLocale } from '../api/catalog.js';
import { formatCount, formatDuration, formatMoney, isFree } from '../lib/format.js';

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr');
}

export function CoverArt({ course }: { course: Pick<Course, 'coverStyle' | 'category'> }) {
  return (
    <div className={`cover cover-${course.coverStyle}`}>
      <span className="cat">{course.category.name}</span>
      <span className="play" aria-hidden="true">
        <Play size={18} fill="#fff" />
      </span>
    </div>
  );
}

export function Rating({ course }: { course: Pick<Course, 'ratingAverage' | 'ratingCount'> }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (course.ratingCount === 0) return null;
  return (
    <span
      className="star"
      aria-label={t('card.rating', {
        rating: course.ratingAverage.toFixed(1),
        count: course.ratingCount,
      })}
    >
      <Star size={13} fill="currentColor" aria-hidden="true" /> {course.ratingAverage.toFixed(1)}
      <span className="rating-count" aria-hidden="true">
        ({formatCount(course.ratingCount, locale)})
      </span>
    </span>
  );
}

export function PriceTag({ course }: { course: Pick<Course, 'price'> }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (isFree(course.price)) return <span className="badge badge-free">{t('card.free')}</span>;
  return (
    <span className="price">
      {formatMoney(course.price.amount, course.price.currency, locale)}
      {course.price.listAmount && course.price.listAmount > course.price.amount && (
        <span className="old">
          {formatMoney(course.price.listAmount, course.price.currency, locale)}
        </span>
      )}
    </span>
  );
}

/** The course card from the design system: cover, title, instructor, facts, then price. */
export function CourseCard({ course, enrolled = false }: { course: Course; enrolled?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <article className="course">
      <Link to={`/courses/${course.slug}`} className="course-link">
        <CoverArt course={course} />
        <div className="body">
          <h3 className="title">{course.title}</h3>
          <div className="inst">
            <span className="avatar" aria-hidden="true">
              {initials(course.instructor.name)}
            </span>
            {course.instructor.name}
          </div>
          <div className="meta">
            <span>
              <Clock size={13} aria-hidden="true" />{' '}
              {formatDuration(course.durationMinutes, locale)}
            </span>
            <span className="lvl">
              <TrendingUp size={13} aria-hidden="true" /> {t(`levels.${course.level}`)}
            </span>
            <Rating course={course} />
          </div>
          <div className="foot">
            {enrolled ? (
              <span className="badge badge-pop">{t('card.enrolled')}</span>
            ) : (
              <PriceTag course={course} />
            )}
            <span className="tags">
              {course.isNew && <span className="badge badge-new">{t('card.new')}</span>}
              {course.hasCertificate && (
                <span className="badge badge-soft">{t('card.certificate')}</span>
              )}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="course" aria-hidden="true">
      <div className="skeleton" style={{ height: 150, borderRadius: 0 }} />
      <div className="body">
        <div className="skeleton" style={{ height: 18, width: '85%' }} />
        <div className="skeleton" style={{ height: 14, width: '50%' }} />
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
    </div>
  );
}
