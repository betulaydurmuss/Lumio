import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useTranscript } from '../api/assignments.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

function day(value: string, locale: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function hours(minutes: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60);
}

/** A learner's record of study, laid out to print on A4. */
export function TranscriptPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const { memberId } = useParams();
  const transcript = useTranscript(memberId);

  return (
    <div className="wrap page transcript">
      <div className="page-head no-print">
        <h2>{t('transcript.title')}</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          <Printer size={14} aria-hidden="true" />
          {t('transcript.print')}
        </button>
      </div>
      {transcript.isPending && <div className="skeleton" style={{ height: 160 }} />}
      {transcript.isError && <ErrorAlert error={transcript.error} />}
      {transcript.data && (
        <article className="card transcript-sheet">
          <header className="transcript-head">
            <div>
              <h3>{transcript.data.learner.displayName}</h3>
              <p className="hint">
                {transcript.data.learner.email} · {transcript.data.learner.organization}
              </p>
            </div>
            <p className="hint">
              {t('transcript.generated', { date: day(transcript.data.generatedAt, locale) })}
            </p>
          </header>

          <dl className="transcript-totals">
            <div>
              <dt>{t('transcript.courses')}</dt>
              <dd>{transcript.data.totals.courses}</dd>
            </div>
            <div>
              <dt>{t('transcript.completed')}</dt>
              <dd>{transcript.data.totals.completed}</dd>
            </div>
            <div>
              <dt>{t('transcript.hours')}</dt>
              <dd>{hours(transcript.data.totals.completedMinutes, locale)}</dd>
            </div>
            <div>
              <dt>{t('transcript.certificates')}</dt>
              <dd>{transcript.data.totals.certificates}</dd>
            </div>
          </dl>

          {transcript.data.entries.length === 0 ? (
            <p className="empty">{t('transcript.empty')}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t('transcript.course')}</th>
                    <th scope="col">{t('transcript.length')}</th>
                    <th scope="col">{t('transcript.enrolled')}</th>
                    <th scope="col">{t('transcript.status')}</th>
                    <th scope="col">{t('transcript.certificate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transcript.data.entries.map((entry) => (
                    <tr key={entry.course.slug}>
                      <td>
                        {entry.course.title}
                        {entry.assigned && (
                          <div className="hint">
                            {entry.dueOn
                              ? t('transcript.assignedDue', { date: day(entry.dueOn, locale) })
                              : t('transcript.assigned')}
                          </div>
                        )}
                      </td>
                      <td>{t('transcript.hoursShort', { hours: hours(entry.minutes, locale) })}</td>
                      <td>{day(entry.enrolledAt, locale)}</td>
                      <td>
                        {entry.completedAt
                          ? t('transcript.completedOn', { date: day(entry.completedAt, locale) })
                          : t('transcript.percent', { percent: entry.percent })}
                      </td>
                      <td>
                        {entry.certificateNo ? (
                          <Link to={`/dogrula/${entry.certificateNo}`}>{entry.certificateNo}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint transcript-foot">{t('transcript.foot')}</p>
        </article>
      )}
    </div>
  );
}
