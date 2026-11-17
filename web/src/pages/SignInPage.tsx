import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { authApi, useRefreshMe } from '../api/auth.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const refreshMe = useRefreshMe();
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const destination = (location.state as { from?: string } | null)?.from ?? '/account';

  async function finish() {
    setPassword('');
    await refreshMe();
    void navigate(destination, { replace: true });
  }

  const login = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: async (result) => {
      if (result.next === 'totp') setStep('totp');
      else await finish();
    },
  });

  const totp = useMutation({
    mutationFn: () => authApi.loginTotp(code),
    onSuccess: finish,
    onError: () => setCode(''),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 'password') login.mutate();
    else totp.mutate();
  }

  const pending = login.isPending || totp.isPending;
  const error = step === 'password' ? login.error : totp.error;

  return (
    <section className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        {step === 'password' ? (
          <>
            <h2>{t('signIn.title')}</h2>
            <p className="lead">{t('signIn.lead')}</p>
            {error && <ErrorAlert error={error} />}
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
            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? t('common.loading') : t('signIn.submit')}
            </button>
            <p className="auth-switch">
              <Link to="/forgot-password">{t('signIn.forgot')}</Link>
            </p>
            <p className="auth-switch">
              {t('signIn.noAccount')} <Link to="/sign-up">{t('signIn.signUp')}</Link>
            </p>
          </>
        ) : (
          <>
            <h2>{t('signIn.totpTitle')}</h2>
            <p className="lead">{t('signIn.totpLead')}</p>
            {error && <ErrorAlert error={error} />}
            <div className="field">
              <label htmlFor="code">{t('signIn.code')}</label>
              <input
                id="code"
                className="input input-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button
              className="btn btn-primary btn-block"
              type="submit"
              disabled={pending || code.length !== 6}
            >
              {pending ? t('common.loading') : t('signIn.verify')}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
