import type { AssignmentStatus } from '@lumio/shared';
import { CircleCheck, Download, Send } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMembers } from '../../api/admin.js';
import {
  useAssign,
  useAssignments,
  useAssignmentsCsvHref,
  useRemoveAssignment,
} from '../../api/assignments.js';
import { useCatalog } from '../../api/catalog.js';
import { ErrorAlert } from '../ErrorAlert.js';

const freeCourses = new URLSearchParams({ price: 'free', sort: 'popular' });

const STATUS_BADGE: Record<AssignmentStatus, string> = {
  not_started: 'badge-soft',
  in_progress: 'badge-pop',
  completed: 'badge-free',
  overdue: 'badge-danger',
};

function shortDate(value: string, locale: string) {
  // Due dates are calendar days; read them as such, not as UTC midnight.
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function AssignForm() {
  const { t } = useTranslation();
  const courses = useCatalog(freeCourses);
  const members = useMembers();
  const assign = useAssign();
  const [courseSlug, setCourseSlug] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const active = useMemo(
    () => (members.data ?? []).filter((member) => !member.disabled),
    [members.data],
  );

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    assign.mutate(
      { courseSlug, userIds: [...chosen], dueOn: dueOn || null },
      { onSuccess: () => setChosen(new Set()) },
    );
  }

  return (
    <form className="assign-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="assign-course">{t('assign.course')}</label>
        <select
          id="assign-course"
          className="input"
          required
          value={courseSlug}
          onChange={(event) => setCourseSlug(event.target.value)}
        >
          <option value="">{t('assign.pickCourse')}</option>
          {courses.data?.items.map((course) => (
            <option key={course.slug} value={course.slug}>
              {course.title}
            </option>
          ))}
        </select>
        <p className="hint">{t('assign.freeOnly')}</p>
      </div>
      <div className="field">
        <label htmlFor="assign-due">{t('assign.dueOn')}</label>
        <input
          id="assign-due"
          className="input"
          type="date"
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
        />
      </div>
      <fieldset className="field assign-members">
        <legend>{t('assign.members', { count: chosen.size })}</legend>
        {members.isError && <ErrorAlert error={members.error} />}
        <div className="assign-actions">
          <button
            type="button"
            className="btn-link"
            onClick={() => setChosen(new Set(active.map((member) => member.id)))}
          >
            {t('assign.all')}
          </button>
          <button type="button" className="btn-link" onClick={() => setChosen(new Set())}>
            {t('assign.none')}
          </button>
        </div>
        <ul>
          {active.map((member) => (
            <li key={member.id}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.has(member.id)}
                  onChange={() => toggle(member.id)}
                />{' '}
                {member.displayName} <span className="hint">{member.email}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button
        className="btn btn-accent"
        type="submit"
        disabled={assign.isPending || !courseSlug || chosen.size === 0}
      >
        <Send size={16} aria-hidden="true" />
        {assign.isPending ? t('common.loading') : t('assign.submit')}
      </button>
      {assign.error && <ErrorAlert error={assign.error} />}
      {assign.data && (
        <div className="alert alert-success" role="status">
          <CircleCheck size={18} className="ic" aria-hidden="true" />
          <div>{t('assign.done', assign.data)}</div>
        </div>
      )}
    </form>
  );
}

function AssignmentReport() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const assignments = useAssignments();
  const remove = useRemoveAssignment();
  const csvHref = useAssignmentsCsvHref();

  return (
    <article className="card">
      <div className="card-head">
        <h3>{t('assign.report')}</h3>
        <a className="btn btn-secondary btn-sm" href={csvHref} download>
          <Download size={14} aria-hidden="true" />
          {t('assign.csv')}
        </a>
      </div>
      <p className="hint">{t('assign.reportLead')}</p>
      {assignments.isPending && <div className="skeleton" style={{ height: 96 }} />}
      {assignments.isError && <ErrorAlert error={assignments.error} />}
      {remove.error && <ErrorAlert error={remove.error} />}
      {assignments.data?.length === 0 && <p className="empty">{t('assign.none_yet')}</p>}
      {Boolean(assignments.data?.length) && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('assign.member')}</th>
                <th scope="col">{t('assign.course')}</th>
                <th scope="col">{t('assign.dueOn')}</th>
                <th scope="col">{t('assign.status')}</th>
                <th scope="col">{t('assign.progress')}</th>
                <th scope="col">
                  <span className="sr-only">{t('assign.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.data?.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/admin/members/${row.member.id}/transcript`}>
                      {row.member.displayName}
                    </Link>
                    <div className="hint">{row.member.email}</div>
                  </td>
                  <td>{row.course.title}</td>
                  <td>{row.dueOn ? shortDate(row.dueOn, locale) : '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[row.status]}`}>
                      {t(`assign.statuses.${row.status}`)}
                    </span>
                  </td>
                  <td>%{row.percent}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(t('assign.removeConfirm'))) remove.mutate(row.id);
                      }}
                    >
                      {t('assign.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function AssignmentsPanel() {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <article className="card">
        <h3>{t('assign.title')}</h3>
        <p className="hint">{t('assign.lead')}</p>
        <AssignForm />
      </article>
      <AssignmentReport />
    </div>
  );
}
