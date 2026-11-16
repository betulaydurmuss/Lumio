import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Mail } from 'lucide-react';
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

  // A query rather than an effect: it runs once per token even under StrictMode.
  const verification = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => authApi.verifyEmail(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });

  return (
    <section className="auth-page">
      <div className="card auth-card centered" aria-live="polite">
        {!token || verification.isError ? (
          <>
            <h2>{t('verify.failed')}</h2>
            <ErrorAlert error={verification.error} />
          </>
        ) : verification.isPending ? (
          <p>{t('verify.checking')}</p>
        ) : (
          <>
            <span className="auth-icon success" aria-hidden="true">
              <CircleCheck size={22} />
            </span>
            <h2>{t('verify.done')}</h2>
            <p>{t('verify.doneBody')}</p>
            <Link to="/sign-in" className="btn btn-primary">
              {t('verify.signIn')}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
