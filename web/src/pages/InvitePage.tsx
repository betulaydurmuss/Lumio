import { PASSWORD_MIN_LENGTH, type Locale } from '@lumio/shared';
import { CircleCheck, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useAcceptInvitation, useInvitationPreview } from '../api/admin.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

export function InvitePage() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    accept.mutate({
      token,
      displayName,
      password,
      locale: (i18n.resolvedLanguage ?? 'tr') as Locale,
    });
  }

  if (!token || preview.isError) {
    return (
      <section className="auth-page">
        <div className="card auth-card centered">
          <h2>{t('invitePage.title')}</h2>
          <div className="alert alert-danger" role="alert">
            <div>{t('invitePage.invalid')}</div>
          </div>
        </div>
      </section>
    );
  }

  if (accept.isSuccess) {
    return (
      <section className="auth-page">
        <div className="card auth-card centered">
          <span className="auth-icon success" aria-hidden="true">
            <CircleCheck size={22} />
          </span>
          <h2>{t('invitePage.title')}</h2>
          <p>{t('invitePage.done')}</p>
          <Link to="/sign-in" className="btn btn-primary">
            {t('invitePage.signIn')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <span className="auth-icon" aria-hidden="true">
          <Users size={22} />
        </span>
        <h2>{t('invitePage.title')}</h2>
        {preview.isPending ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : (
          <>
            <p className="lead">
              {t('invitePage.lead', {
                organization: preview.data.organizationName,
                role: t(`account.roles.${preview.data.role}`),
              })}
            </p>
            {accept.error && <ErrorAlert error={accept.error} />}
            <div className="field">
              <label htmlFor="invite-email-readonly">{t('invitePage.email')}</label>
              <input
                id="invite-email-readonly"
                className="input"
                value={preview.data.email}
                readOnly
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label htmlFor="invite-name">{t('invitePage.name')}</label>
              <input
                id="invite-name"
                className="input"
                autoComplete="name"
                required
                minLength={2}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="invite-password">{t('invitePage.password')}</label>
              <input
                id="invite-password"
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                aria-describedby="invite-password-hint"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p id="invite-password-hint" className="hint">
                {t('signUp.passwordHint')}
              </p>
            </div>
            <button className="btn btn-accent btn-block" type="submit" disabled={accept.isPending}>
              {accept.isPending ? t('common.loading') : t('invitePage.submit')}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
