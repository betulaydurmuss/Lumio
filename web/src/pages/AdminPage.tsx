import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const members = useQuery({
    queryKey: ['org', 'members'],
    queryFn: authApi.members,
    retry: false,
  });
  const audit = useQuery({
    queryKey: ['org', 'audit'],
    queryFn: authApi.auditLogs,
    retry: false,
    enabled: members.isSuccess,
  });

  const needsMfa = members.error instanceof ApiError && members.error.code === 'mfa_required';

  return (
    <div className="wrap page">
      <header className="page-head">
        <h2>{t('admin.title')}</h2>
      </header>

      {members.isError && (
        <ErrorAlert error={members.error}>
          {needsMfa && (
            <p style={{ margin: '8px 0 0' }}>
              <Link to="/account" className="btn btn-primary btn-sm">
                {t('admin.setup2fa')}
              </Link>
            </p>
          )}
        </ErrorAlert>
      )}

      {!members.isError && (
        <div className="stack">
          <article className="card">
            <h3>{t('admin.members')}</h3>
            {members.isPending && <div className="skeleton" style={{ height: 96 }} />}
            {members.data?.length === 0 && <p className="empty">{t('admin.noMembers')}</p>}
            {members.data && members.data.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('admin.name')}</th>
                      <th>{t('admin.email')}</th>
                      <th>{t('admin.role')}</th>
                      <th>{t('admin.verified')}</th>
                      <th>{t('admin.twoFactor')}</th>
                      <th>{t('admin.joined')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.data.map((member) => (
                      <tr key={member.id}>
                        <td>{member.displayName}</td>
                        <td>{member.email}</td>
                        <td>{t(`account.roles.${member.role}`)}</td>
                        <td>{member.emailVerified ? t('admin.yes') : t('admin.no')}</td>
                        <td>{member.twoFactorEnabled ? t('admin.yes') : t('admin.no')}</td>
                        <td className="mono">{formatDate(member.createdAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card">
            <h3>{t('admin.audit')}</h3>
            <p className="hint">{t('admin.auditLead')}</p>
            {audit.isPending && <div className="skeleton" style={{ height: 96 }} />}
            {audit.isError && <ErrorAlert error={audit.error} />}
            {audit.data?.length === 0 && <p className="empty">{t('admin.noAudit')}</p>}
            {audit.data && audit.data.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('admin.when')}</th>
                      <th>{t('admin.action')}</th>
                      <th>{t('admin.ip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.map((entry) => (
                      <tr key={entry.id}>
                        <td className="mono">{formatDate(entry.createdAt, locale)}</td>
                        <td className="mono">{entry.action}</td>
                        <td className="mono">{entry.ipAddress ?? '—'}</td>
                      </tr>
                    ))}
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
