import type { Me } from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Download, Monitor, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { authApi, useMe, useRefreshMe } from '../api/auth.js';
import { DATA_EXPORT_HREF, useConsents, useUpdateConsents } from '../api/me.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function TwoFactorCard({ me }: { me: Me }) {
  const { t } = useTranslation();
  const refreshMe = useRefreshMe();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  // The password is asked again so a borrowed session alone cannot bind a new
  // authenticator to the account.
  const setup = useMutation({
    mutationFn: () => authApi.totpSetup(password),
    onSettled: () => setPassword(''),
  });
  const enable = useMutation({
    mutationFn: () => authApi.totpEnable(code),
    onSuccess: async () => {
      setup.reset();
      await refreshMe();
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: () => setCode(''),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    enable.mutate();
  }

  return (
    <article className="card">
      <div className="card-head">
        <h3>{t('account.twoFactor')}</h3>
        <span className={`badge ${me.twoFactorEnabled ? 'badge-free' : 'badge-soft'}`}>
          {me.twoFactorEnabled ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {me.twoFactorEnabled ? t('account.twoFactorOn') : t('account.twoFactorOff')}
        </span>
      </div>

      {enable.isSuccess && (
        <div className="alert alert-success" role="status">
          <CircleCheck size={18} className="ic" aria-hidden="true" />
          <div>{t('account.enabled')}</div>
        </div>
      )}

      {enable.data && (
        <div className="recovery-codes">
          <p>
            <strong>{t('account.recoveryTitle')}</strong>
          </p>
          <p className="hint">{t('account.recoveryHint')}</p>
          <ul>
            {enable.data.recoveryCodes.map((recovery) => (
              <li key={recovery}>
                <code>{recovery}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!me.twoFactorEnabled && me.twoFactorRequired && !setup.data && (
        <div className="alert alert-warn" role="status">
          <ShieldAlert size={18} className="ic" aria-hidden="true" />
          <div>{t('account.twoFactorRequired')}</div>
        </div>
      )}

      {!me.twoFactorEnabled && !setup.data && (
        <>
          {setup.error && <ErrorAlert error={setup.error} />}
          <form
            className="totp-start"
            onSubmit={(event) => {
              event.preventDefault();
              setup.mutate();
            }}
          >
            <label htmlFor="totp-password">{t('account.confirmPassword')}</label>
            <div className="inline-form">
              <input
                id="totp-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={setup.isPending || password.length === 0}
              >
                {setup.isPending ? t('common.loading') : t('account.setup')}
              </button>
            </div>
          </form>
        </>
      )}

      {setup.data && (
        <form className="totp-setup" onSubmit={submit}>
          <ol>
            <li>
              <p>{t('account.setupStep1')}</p>
              <img src={setup.data.qrDataUrl} alt={t('account.qrAlt')} width={180} height={180} />
              <p className="hint">{t('account.manual')}</p>
              <code className="secret">{setup.data.secret}</code>
            </li>
            <li>
              <label htmlFor="totp-code">{t('account.setupStep2')}</label>
              {enable.error && <ErrorAlert error={enable.error} />}
              <div className="inline-form">
                <input
                  id="totp-code"
                  className="input input-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
                <button
                  className="btn btn-accent"
                  type="submit"
                  disabled={enable.isPending || code.length !== 6}
                >
                  {enable.isPending ? t('common.loading') : t('account.enable')}
                </button>
              </div>
            </li>
          </ol>
        </form>
      )}
    </article>
  );
}

function SessionsCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions });
  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const locale = i18n.resolvedLanguage ?? 'tr';

  return (
    <article className="card">
      <h3>{t('account.sessions')}</h3>
      <p className="hint">{t('account.sessionsLead')}</p>
      {sessions.isPending && <div className="skeleton" style={{ height: 64 }} />}
      {sessions.isError && (
        <ErrorAlert error={sessions.error}>
          <button className="btn btn-ghost btn-sm" onClick={() => void sessions.refetch()}>
            {t('common.retry')}
          </button>
        </ErrorAlert>
      )}
      {revoke.error && <ErrorAlert error={revoke.error} />}
      {sessions.data?.length === 0 && <p className="empty">{t('account.noSessions')}</p>}
      {sessions.data && sessions.data.length > 0 && (
        <ul className="session-list">
          {sessions.data.map((session) => (
            <li key={session.id}>
              <Monitor size={18} aria-hidden="true" />
              <div className="session-meta">
                <strong>
                  {session.userAgent?.slice(0, 80) ?? t('account.unknownDevice')}
                  {session.current && (
                    <span className="badge badge-new">{t('account.current')}</span>
                  )}
                </strong>
                <span className="mono">
                  {session.ipAddress ?? '—'} · {t('account.lastUsed')}{' '}
                  {formatDate(session.lastUsedAt, locale)}
                </span>
              </div>
              {!session.current && (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(session.id)}
                >
                  {t('account.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function PrivacyCard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const consents = useConsents();
  const update = useUpdateConsents();

  return (
    <article className="card">
      <h3>{t('privacy.title')}</h3>
      <p className="hint">
        {t('privacy.lead')} <Link to="/privacy">{t('privacy.notice')}</Link>
      </p>
      {consents.isError && <ErrorAlert error={consents.error} />}
      {update.error && <ErrorAlert error={update.error} />}
      {consents.data && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={consents.data.marketingEmail}
              disabled={update.isPending}
              onChange={(event) => update.mutate({ marketingEmail: event.target.checked })}
            />
            <span>{t('privacy.marketing')}</span>
          </label>
          {consents.data.history.length > 0 && (
            <details className="consent-history">
              <summary>{t('privacy.history')}</summary>
              <ul>
                {consents.data.history.map((row) => (
                  <li key={row.createdAt}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(row.createdAt))}{' '}
                    · {row.granted ? t('privacy.granted') : t('privacy.withdrawn')} ·{' '}
                    {t('privacy.version', { version: row.noticeVersion })}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <a className="btn btn-secondary btn-sm" href={DATA_EXPORT_HREF} download>
        <Download size={14} aria-hidden="true" />
        {t('privacy.export')}
      </a>
      <p className="hint">{t('privacy.exportHint')}</p>
    </article>
  );
}

export function AccountPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  if (!me) return null;

  return (
    <div className="wrap page">
      <header className="page-head">
        <h2>{t('account.title')}</h2>
        <p className="lead">
          {me.displayName} · {me.email}
        </p>
        <p className="hint">
          {t('account.organization')}: <strong>{me.organization.name}</strong> · {t('account.role')}
          : <strong>{t(`account.roles.${me.role}`)}</strong>
        </p>
      </header>
      <h3 className="section-title">{t('account.security')}</h3>
      <div className="stack">
        <TwoFactorCard me={me} />
        <SessionsCard />
        <PrivacyCard />
      </div>
    </div>
  );
}
