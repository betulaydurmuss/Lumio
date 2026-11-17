import { PASSWORD_MIN_LENGTH } from '@lumio/shared';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { authApi } from '../api/auth.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const request = useMutation({ mutationFn: () => authApi.forgotPassword(email) });

  function submit(event: FormEvent) {
    event.preventDefault();
    request.mutate();
  }

  if (request.isSuccess) {
    return (
      <section className="auth-page">
        <div className="card auth-card centered" role="status">
          <span className="auth-icon" aria-hidden="true">
            <Mail size={22} />
          </span>
          <h2>{t('forgot.sentTitle')}</h2>
          <p>{t('forgot.sentBody', { email })}</p>
          <p className="hint">{t('checkEmail.note')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h2>{t('forgot.title')}</h2>
        <p className="lead">{t('forgot.lead')}</p>
        {request.error && <ErrorAlert error={request.error} />}
        <div className="field">
          <label htmlFor="email">{t('signIn.email')}</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={request.isPending || email.length === 0}
        >
          {request.isPending ? t('common.loading') : t('forgot.submit')}
        </button>
        <p className="auth-switch">
          <Link to="/sign-in">{t('forgot.back')}</Link>
        </p>
      </form>
    </section>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const reset = useMutation({
    mutationFn: () => authApi.resetPassword({ token, password }),
    onSettled: () => setPassword(''),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    reset.mutate();
  }

  if (reset.isSuccess) {
    return (
      <section className="auth-page">
        <div className="card auth-card centered" role="status">
          <span className="auth-icon success" aria-hidden="true">
            <CircleCheck size={22} />
          </span>
          <h2>{t('reset.done')}</h2>
          <p>{t('reset.doneBody')}</p>
          <Link to="/sign-in" className="btn btn-primary">
            {t('verify.signIn')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h2>{t('reset.title')}</h2>
        <p className="lead">{t('reset.lead')}</p>
        {reset.error && <ErrorAlert error={reset.error} />}
        <div className="field">
          <label htmlFor="new-password">{t('reset.password')}</label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="new-password-hint"
          />
          <p id="new-password-hint" className="hint">
            {t('signUp.passwordHint')}
          </p>
        </div>
        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={!token || reset.isPending || password.length < PASSWORD_MIN_LENGTH}
        >
          {reset.isPending ? t('common.loading') : t('reset.submit')}
        </button>
      </form>
    </section>
  );
}
