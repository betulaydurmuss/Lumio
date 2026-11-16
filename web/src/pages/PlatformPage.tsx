import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { usePlatformCourses, usePlatformOverview, useSetCourseStatus } from '../api/admin.js';
import { useLocale } from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { StatTiles, StatTilesSkeleton } from '../components/admin/StatTiles.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { formatCount } from '../lib/format.js';

export function PlatformPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const overview = usePlatformOverview();
  const courses = usePlatformCourses();
  const setStatus = useSetCourseStatus();
  const needsMfa = overview.error instanceof ApiError && overview.error.code === 'mfa_required';

  return (
    <div className="wrap page">
      <header className="page-head">
        <h2>{t('platform.title')}</h2>
        <p className="lead">{t('platform.lead')}</p>
      </header>

      {overview.isError && (
        <ErrorAlert error={overview.error}>
          {needsMfa && (
            <p style={{ margin: '8px 0 0' }}>
              <Link to="/account" className="btn btn-primary btn-sm">
                {t('admin.setup2fa')}
              </Link>
            </p>
          )}
        </ErrorAlert>
      )}

      {!overview.isError && (
        <div className="stack">
          {overview.data ? (
            <StatTiles
              items={(
                [
                  'organizations',
                  'users',
                  'enrollments',
                  'completions',
                  'certificates',
                  'publishedCourses',
                ] as const
              ).map((key) => ({ label: t(`platform.${key}`), value: overview.data.totals[key] }))}
            />
          ) : (
            <StatTilesSkeleton count={6} />
          )}

          <article className="card">
            <h3>{t('platform.organizations')}</h3>
            {overview.data && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('platform.orgName')}</th>
                      <th>{t('platform.kind')}</th>
                      <th>{t('platform.members')}</th>
                      <th>{t('platform.enrollments')}</th>
                      <th>{t('platform.completions')}</th>
                      <th>{t('platform.created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.data.organizations.map((org) => (
                      <tr key={org.id}>
                        <td className={org.name ? undefined : 'hint'}>
                          {org.name ?? t('platform.personalAccount')}
                        </td>
                        <td>{t(`platform.kinds.${org.kind}`)}</td>
                        <td className="mono">{formatCount(org.members, locale)}</td>
                        <td className="mono">{formatCount(org.enrollments, locale)}</td>
                        <td className="mono">{formatCount(org.completions, locale)}</td>
                        <td className="mono">
                          {new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
                            dateStyle: 'medium',
                          }).format(new Date(org.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card">
            <h3>{t('platform.courses')}</h3>
            <p className="hint">{t('platform.coursesLead')}</p>
            {setStatus.error && <ErrorAlert error={setStatus.error} />}
            {courses.isPending && <div className="skeleton" style={{ height: 120 }} />}
            {courses.data && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('platform.course')}</th>
                      <th>{t('platform.status')}</th>
                      <th>{t('platform.enrollments')}</th>
                      <th>{t('platform.completions')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {courses.data.map((course) => {
                      const published = course.status === 'published';
                      return (
                        <tr key={course.slug} className={published ? undefined : 'row-muted'}>
                          <td>
                            <Link to={`/courses/${course.slug}`}>{course.title}</Link>
                          </td>
                          <td>
                            <span className={`badge ${published ? 'badge-free' : 'badge-soft'}`}>
                              {published ? t('platform.published') : t('platform.draft')}
                            </span>
                          </td>
                          <td className="mono">{formatCount(course.enrollmentCount, locale)}</td>
                          <td className="mono">{formatCount(course.completionCount, locale)}</td>
                          <td>
                            <button
                              type="button"
                              className={`btn btn-sm ${published ? 'btn-ghost' : 'btn-secondary'}`}
                              disabled={setStatus.isPending}
                              onClick={() =>
                                setStatus.mutate({
                                  slug: course.slug,
                                  status: published ? 'draft' : 'published',
                                })
                              }
                            >
                              {published ? t('platform.unpublish') : t('platform.publish')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
