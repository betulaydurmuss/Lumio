import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useAuditLog, useOrgStats } from '../api/admin.js';
import { useOrgCertificates, useRevokeCertificate } from '../api/certificates.js';
import { ApiError } from '../api/client.js';
import { MembersPanel } from '../components/admin/MembersPanel.js';
import { StatTiles, StatTilesSkeleton } from '../components/admin/StatTiles.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

const TABS = ['overview', 'members', 'certificates', 'audit'] as const;
type Tab = (typeof TABS)[number];

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

function AuditCard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const audit = useAuditLog();
  return (
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
  );
}

export function AdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : 'overview';
  // The stats call doubles as the gate: it fails with mfa_required until 2FA is on.
  const stats = useOrgStats();
  const needsMfa = stats.error instanceof ApiError && stats.error.code === 'mfa_required';

  return (
    <div className="wrap page">
      <header className="page-head">
        <h2>{t('admin.title')}</h2>
      </header>

      {stats.isError && (
        <ErrorAlert error={stats.error}>
          {needsMfa && (
            <p style={{ margin: '8px 0 0' }}>
              <Link to="/account" className="btn btn-primary btn-sm">
                {t('admin.setup2fa')}
              </Link>
            </p>
          )}
        </ErrorAlert>
      )}

      {!stats.isError && (
        <>
          <div className="tabs" role="tablist">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === name}
                onClick={() => setParams(name === 'overview' ? {} : { tab: name })}
              >
                {t(`adminTabs.${name}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'overview' &&
              (stats.data ? (
                <StatTiles
                  items={(
                    [
                      'members',
                      'pendingInvitations',
                      'enrollments',
                      'completions',
                      'certificates',
                      'disabledMembers',
                    ] as const
                  ).map((key) => ({ label: t(`adminStats.${key}`), value: stats.data[key] }))}
                />
              ) : (
                <StatTilesSkeleton count={6} />
              ))}
            {tab === 'members' && <MembersPanel />}
            {tab === 'certificates' && <CertificatesCard />}
            {tab === 'audit' && <AuditCard />}
          </div>
        </>
      )}
    </div>
  );
}

/** The organization's certificates, with a two-step revoke that asks for a reason. */
function CertificatesCard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const certificates = useOrgCertificates();
  const revoke = useRevokeCertificate();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function confirm(event: FormEvent, certNo: string) {
    event.preventDefault();
    revoke.mutate(
      { certNo, reason },
      {
        onSuccess: () => {
          setRevoking(null);
          setReason('');
        },
      },
    );
  }

  return (
    <article className="card">
      <h3>{t('adminCerts.title')}</h3>
      <p className="hint">{t('adminCerts.lead')}</p>
      {certificates.isPending && <div className="skeleton" style={{ height: 96 }} />}
      {certificates.isError && <ErrorAlert error={certificates.error} />}
      {revoke.error && <ErrorAlert error={revoke.error} />}
      {certificates.data?.length === 0 && <p className="empty">{t('adminCerts.empty')}</p>}
      {certificates.data && certificates.data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('adminCerts.certNo')}</th>
                <th>{t('adminCerts.recipient')}</th>
                <th>{t('adminCerts.course')}</th>
                <th>{t('adminCerts.issued')}</th>
                <th>{t('adminCerts.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {certificates.data.map((row) => (
                <tr key={row.certNo}>
                  <td className="mono">
                    <Link to={`/dogrula/${row.certNo}`}>{row.certNo}</Link>
                  </td>
                  <td>{row.recipientName}</td>
                  <td>{row.courseTitle}</td>
                  <td className="mono">{formatDate(row.issuedAt, locale)}</td>
                  <td>
                    <span className={`badge ${row.revokedAt ? 'badge-soft' : 'badge-free'}`}>
                      {row.revokedAt ? t('adminCerts.revoked') : t('adminCerts.valid')}
                    </span>
                  </td>
                  <td>
                    {!row.revokedAt && revoking !== row.certNo && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setRevoking(row.certNo)}
                      >
                        {t('adminCerts.revoke')}
                      </button>
                    )}
                    {revoking === row.certNo && (
                      <form
                        className="revoke-form"
                        onSubmit={(event) => confirm(event, row.certNo)}
                      >
                        <label className="visually-hidden" htmlFor={`reason-${row.certNo}`}>
                          {t('adminCerts.reason')}
                        </label>
                        <input
                          id={`reason-${row.certNo}`}
                          className="input"
                          placeholder={t('adminCerts.reasonPlaceholder')}
                          minLength={3}
                          maxLength={300}
                          required
                          autoFocus
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn btn-danger btn-sm"
                          disabled={reason.trim().length < 3 || revoke.isPending}
                        >
                          {t('adminCerts.confirm')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRevoking(null)}
                        >
                          {t('adminCerts.cancel')}
                        </button>
                      </form>
                    )}
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
