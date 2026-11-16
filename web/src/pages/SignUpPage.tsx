import { PASSWORD_MIN_LENGTH, type Locale } from '@lumio/shared';
import { useMutation } from '@tanstack/react-query';
import { Building2, User } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../api/auth.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

type AccountType = 'personal' | 'company';

const accountTypes = [
  { type: 'personal', Icon: User },
  { type: 'company', Icon: Building2 },
] as const;

export function SignUpPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // "For teams" links arrive with ?type=company so the company form is already open.
  const requestedType: AccountType = params.get('type') === 'company' ? 'company' : 'personal';
  const [accountType, setAccountType] = useState<AccountType>(requestedType);
  // Following the link again while already on this page should still switch the form.
  useEffect(() => setAccountType(requestedType), [requestedType]);
  const [organizationName, setOrganizationName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const register = useMutation({
    mutationFn: () =>
      authApi.register({
        accountType,
        ...(accountType === 'company' ? { organizationName } : {}),
        displayName,
        email,
        password,
        locale: (i18n.resolvedLanguage ?? 'tr') as Locale,
      }),
    onSuccess: () => void navigate('/check-email', { state: { email } }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    register.mutate();
  }

  return (
    <section className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h2>{t('signUp.title')}</h2>
        <p className="lead">{t('signUp.lead')}</p>
        {register.error && <ErrorAlert error={register.error} />}

        <fieldset className="choice-group">
          <legend>{t('signUp.accountType')}</legend>
          {accountTypes.map(({ type, Icon }) => (
            <label key={type} className="choice" data-checked={accountType === type}>
              <input
                type="radio"
                name="accountType"
                value={type}
                checked={accountType === type}
                onChange={() => setAccountType(type)}
              />
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{t(`signUp.${type}`)}</strong>
                <small>{t(`signUp.${type}Hint`)}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {accountType === 'company' && (
          <>
            <div className="field">
              <label htmlFor="organization">{t('signUp.organization')}</label>
              <input
                id="organization"
                className="input"
                autoComplete="organization"
                required
                minLength={2}
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
              />
            </div>
            <p className="hint">{t('signUp.companyNote')}</p>
          </>
        )}

        <div className="field">
          <label htmlFor="name">{t('signUp.name')}</label>
          <input
            id="name"
            className="input"
            autoComplete="name"
            required
            minLength={2}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="email">{t('signUp.email')}</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t('signUp.password')}</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            aria-describedby="password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id="password-hint" className="hint">
            {t('signUp.passwordHint')}
          </p>
        </div>

        <button className="btn btn-accent btn-block" type="submit" disabled={register.isPending}>
          {register.isPending ? t('common.loading') : t('signUp.submit')}
        </button>
        <p className="auth-switch">
          {t('signUp.haveAccount')} <Link to="/sign-in">{t('signUp.signIn')}</Link>
        </p>
      </form>
    </section>
  );
}
