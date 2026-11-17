import { useMutation } from '@tanstack/react-query';
import { CircleCheck, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { authApi } from '../api/auth.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

export function CheckEmailPage() {
  const { t } = useTranslation();
  const email = (useLocation().state as { email?: string } | null)?.email ?? '';
  return (
    <section className="auth-page">
      <div className="card auth-card centered">
        <span className="auth-icon" aria-hidden="true">
          <Mail size={22} />
        </span>
        <h2>{t('checkEmail.title')}</h2>
        <p>{t('checkEmail.body', { email })}</p>
        <p className="hint">{t('checkEmail.note')}</p>
      </div>
    </section>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');

  // The link proves the mailbox; the password proves this is the person who
  // signed up, so nobody can have their own sign-up activated by the owner.
  const verification = useMutation({
    mutationFn: () => authApi.verifyEmail(token, password),
    onSettled: () => setPassword(''),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    verification.mutate();
  }

  if (!token) {
    return (
      <section className="auth-page">
        <div className="card auth-card centered">
          <h2>{t('verify.failed')}</h2>
        </div>
      </section>
    );
  }

  if (!verification.isSuccess) {
    return (
      <section className="auth-page">
        <form className="card auth-card" onSubmit={submit} noValidate>
          <h2>{t('verify.title')}</h2>
          <p className="lead">{t('verify.lead')}</p>
          {verification.error && <ErrorAlert error={verification.error} />}
          <div className="field">
            <label htmlFor="password">{t('signIn.password')}</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={verification.isPending || password.length === 0}
          >
            {verification.isPending ? t('common.loading') : t('verify.submit')}
          </button>
          <p className="hint">
            {t('verify.notYou')} <Link to="/sign-up">{t('signIn.signUp')}</Link>
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="card auth-card centered" role="status">
        <span className="auth-icon success" aria-hidden="true">
          <CircleCheck size={22} />
        </span>
        <h2>{t('verify.done')}</h2>
        <p>{t('verify.doneBody')}</p>
        <Link to="/sign-in" className="btn btn-primary">
          {t('verify.signIn')}
        </Link>
      </div>
    </section>
  );
}
