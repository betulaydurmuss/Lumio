import type { CourseDetail } from '@lumio/shared';
import {
  Award,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  Eye,
  Globe,
  Heart,
  MousePointerClick,
  PlayCircle,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useMe } from '../api/auth.js';
import { useCourse, useCourseActions, useLocale } from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { CourseCard, CoverArt, PriceTag, Rating } from '../components/CourseCard.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { PageSkeleton } from '../components/RequireAuth.js';
import { formatCount, formatDate, formatDuration, isFree } from '../lib/format.js';

const lessonIcon = { video: PlayCircle, interactive: MousePointerClick, reading: BookOpen };

function Curriculum({ course }: { course: CourseDetail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  const allOpen = open.size === course.sections.length;

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section className="course-section">
      <div className="curriculum-head">
        <div>
          <h3>{t('course.curriculum')}</h3>
          <p className="hint">
            {t('course.curriculumSummary', {
              sections: course.sections.length,
              lessons: course.lessonCount,
              duration: formatDuration(course.durationMinutes, locale),
            })}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setOpen(allOpen ? new Set() : new Set(course.sections.map((_, index) => index)))
          }
        >
          {allOpen ? t('course.collapseAll') : t('course.expandAll')}
        </button>
      </div>
      <div className="accordion">
        {course.sections.map((section, index) => {
          const expanded = open.has(index);
          const panelId = `section-${index}`;
          return (
            <div key={section.title} className="accordion-item">
              <h4>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                >
                  <ChevronDown size={18} className="chevron" aria-hidden="true" />
                  <span className="accordion-title">{section.title}</span>
                  <span className="accordion-meta">
                    {t('card.lessons', { count: section.lessons.length })} ·{' '}
                    {formatDuration(section.durationMinutes, locale)}
                  </span>
                </button>
              </h4>
              <ul id={panelId} className="lesson-list" hidden={!expanded}>
                {section.lessons.map((lesson) => {
                  const Icon = lessonIcon[lesson.type];
                  return (
                    <li key={lesson.id}>
                      <Icon size={16} aria-label={t(`course.lessonTypes.${lesson.type}`)} />
                      {course.viewer?.enrolled || lesson.isPreview ? (
                        <Link className="lesson-title" to={`/learn/${course.slug}/${lesson.id}`}>
                          {lesson.title}
                        </Link>
                      ) : (
                        <span className="lesson-title">{lesson.title}</span>
                      )}
                      {lesson.isPreview && (
                        <Link
                          className="badge badge-new"
                          to={`/learn/${course.slug}/${lesson.id}`}
                          aria-label={`${t('course.preview')}: ${lesson.title}`}
                        >
                          <Eye size={12} aria-hidden="true" />
                          {t('course.preview')}
                        </Link>
                      )}
                      <span className="mono lesson-time">
                        {formatDuration(lesson.durationMinutes, locale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PurchaseCard({ course }: { course: CourseDetail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const me = useMe();
  const { enroll, wishlist } = useCourseActions(course.slug);
  const signedIn = Boolean(me.data);
  const free = isFree(course.price);
  const hasPreview = course.sections.some((section) =>
    section.lessons.some((lesson) => lesson.isPreview),
  );

  return (
    <aside className="card purchase-card">
      <CoverArt course={course} />
      <div className="purchase-body">
        <div className="purchase-price">
          <PriceTag course={course} />
        </div>

        {enroll.error && <ErrorAlert error={enroll.error} />}
        {wishlist.error && <ErrorAlert error={wishlist.error} />}

        {course.viewer?.enrolled ? (
          <>
            <Link to={`/learn/${course.slug}`} className="btn btn-accent btn-lg btn-block">
              <PlayCircle size={18} aria-hidden="true" />
              {t('course.continueCourse')}
            </Link>
            <p className="hint enrolled-note">
              <CircleCheck size={14} aria-hidden="true" /> {t('card.enrolled')}
            </p>
          </>
        ) : !signedIn ? (
          <Link
            to="/sign-in"
            state={{ from: `/courses/${course.slug}` }}
            className="btn btn-accent btn-lg btn-block"
          >
            {t('course.signInToEnroll')}
          </Link>
        ) : free ? (
          <button
            type="button"
            className="btn btn-accent btn-lg btn-block"
            disabled={enroll.isPending}
            onClick={() => enroll.mutate()}
          >
            {enroll.isPending ? t('common.loading') : t('course.enroll')}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-accent btn-lg btn-block" disabled>
              {t('course.buy')}
            </button>
            <p className="hint">{t('course.paidNote')}</p>
          </>
        )}

        {signedIn && !course.viewer?.enrolled && (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            aria-pressed={course.viewer?.wishlisted ?? false}
            disabled={wishlist.isPending}
            onClick={() => wishlist.mutate(!course.viewer?.wishlisted)}
          >
            <Heart
              size={16}
              aria-hidden="true"
              fill={course.viewer?.wishlisted ? 'currentColor' : 'none'}
            />
            {course.viewer?.wishlisted ? t('course.wishlistRemove') : t('course.wishlistAdd')}
          </button>
        )}

        <h4 className="includes-title">{t('course.includes')}</h4>
        <ul className="includes">
          <li>
            <Clock size={16} aria-hidden="true" />
            {t('course.includesDuration', {
              duration: formatDuration(course.durationMinutes, locale),
            })}
          </li>
          <li>
            <BookOpen size={16} aria-hidden="true" />
            {t('card.lessons', { count: course.lessonCount })}
          </li>
          {course.hasCertificate && (
            <li>
              <Award size={16} aria-hidden="true" />
              {t('course.includesCertificate')}
            </li>
          )}
          {hasPreview && (
            <li>
              <Eye size={16} aria-hidden="true" />
              {t('course.includesPreview')}
            </li>
          )}
          <li>
            <Globe size={16} aria-hidden="true" />
            {t(`languages.${course.language}`)}
          </li>
        </ul>
      </div>
    </aside>
  );
}

function BulletList({ items, icon = true }: { items: string[]; icon?: boolean }) {
  return (
    <ul className={icon ? 'check-list' : 'plain-list'}>
      {items.map((item) => (
        <li key={item}>
          {icon && <Check size={16} aria-hidden="true" />}
          {item}
        </li>
      ))}
    </ul>
  );
}

export function CoursePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { slug = '' } = useParams();
  const course = useCourse(slug);

  if (course.isPending) return <PageSkeleton />;
  if (course.isError) {
    const missing = course.error instanceof ApiError && course.error.status === 404;
    return (
      <section className="empty-state">
        <div className="wrap">
          {missing ? (
            <>
              <h2>{t('course.notFoundTitle')}</h2>
              <p>{t('course.notFoundBody')}</p>
            </>
          ) : (
            <ErrorAlert error={course.error} />
          )}
          <Link to="/courses" className="btn btn-primary">
            {t('course.backToCatalog')}
          </Link>
        </div>
      </section>
    );
  }

  const data = course.data;
  return (
    <>
      <section className="course-hero">
        <div className="wrap course-hero-inner">
          <nav className="breadcrumb" aria-label="breadcrumb">
            <Link to="/courses">{t('course.breadcrumb')}</Link>
            <span aria-hidden="true">›</span>
            <Link to={`/courses?category=${data.category.slug}`}>{data.category.name}</Link>
          </nav>
          <h1>{data.title}</h1>
          <p className="course-subtitle">{data.subtitle}</p>
          <div className="course-facts">
            {data.isNew && <span className="badge badge-new">{t('card.new')}</span>}
            <span className="badge badge-soft">{t(`levels.${data.level}`)}</span>
            <Rating course={data} />
            <span>
              <Users size={15} aria-hidden="true" />{' '}
              {t('card.students', {
                count: data.enrollmentCount,
                formatted: formatCount(data.enrollmentCount, locale),
              })}
            </span>
          </div>
          <div className="course-facts muted">
            <span>{t('course.by', { name: data.instructor.name })}</span>
            <span>
              <RefreshCw size={14} aria-hidden="true" />{' '}
              {t('course.updated', { date: formatDate(data.updatedAt, locale) })}
            </span>
            <span>
              <Globe size={14} aria-hidden="true" />{' '}
              {t('course.taughtIn', { language: t(`languages.${data.language}`) })}
            </span>
          </div>
        </div>
      </section>

      <div className="wrap course-layout">
        <div className="course-main">
          <section className="course-section card outcomes">
            <h3>{t('course.outcomes')}</h3>
            <BulletList items={data.outcomes} />
          </section>

          <Curriculum course={data} />

          <section className="course-section">
            <h3>{t('course.requirements')}</h3>
            <BulletList items={data.requirements} icon={false} />
          </section>

          <section className="course-section">
            <h3>{t('course.about')}</h3>
            <p className="course-description">{data.description}</p>
            <h4 className="sub-title">{t('course.audience')}</h4>
            <BulletList items={data.audience} icon={false} />
          </section>

          <section className="course-section instructor-card">
            <h3>{t('course.instructor')}</h3>
            <div className="instructor-head">
              <span className="avatar avatar-lg" aria-hidden="true">
                {data.instructorProfile.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)}
              </span>
              <div>
                <strong>{data.instructorProfile.name}</strong>
                <p className="hint">{data.instructorProfile.headline}</p>
                <p className="hint mono">
                  {t('course.instructorStats', {
                    courses: data.instructorProfile.courseCount,
                    students: formatCount(data.instructorProfile.studentCount, locale),
                    rating: data.instructorProfile.ratingAverage.toFixed(1),
                  })}
                </p>
              </div>
            </div>
            <p>{data.instructorProfile.bio}</p>
          </section>

          {data.instructorProfile.otherCourses.length > 0 && (
            <section className="course-section">
              <h3>{t('course.otherCourses')}</h3>
              <div className="catalog-grid compact">
                {data.instructorProfile.otherCourses.map((other) => (
                  <CourseCard key={other.slug} course={other} />
                ))}
              </div>
            </section>
          )}
        </div>

        <PurchaseCard course={data} />
      </div>

      {data.related.length > 0 && (
        <section className="section related">
          <div className="wrap">
            <h3 className="section-title">{t('course.related')}</h3>
            <div className="catalog-grid">
              {data.related.map((other) => (
                <CourseCard key={other.slug} course={other} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
