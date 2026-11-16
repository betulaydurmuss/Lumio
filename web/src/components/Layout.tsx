import { locales, rolesRequiringTwoFactor, type Locale } from '@lumio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { authApi, meQueryKey, useMe } from '../api/auth.js';
import { setLocale } from '../i18n/index.js';
import { Logo } from './Logo.js';
import { StatusLine } from './StatusLine.js';

function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div className="lang-switch" role="group" aria-label={t('nav.language')}>
      {locales.map((locale: Locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={i18n.resolvedLanguage === locale}
          onClick={() => setLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function AccountNav() {
  const { t } = useTranslation();
  const me = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await authApi.logout().catch(() => undefined);
    queryClient.setQueryData(meQueryKey, null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    void navigate('/');
  }

  if (me.isPending) return <span className="skeleton nav-skeleton" aria-hidden="true" />;
  if (!me.data) {
    return (
      <>
        <Link to="/sign-in" className="btn btn-ghost btn-sm">
          {t('nav.signIn')}
        </Link>
        <Link to="/sign-up" className="btn btn-accent btn-sm">
          {t('nav.signUp')}
        </Link>
      </>
    );
  }
  return (
    <>
      {rolesRequiringTwoFactor.includes(me.data.role) && (
        <NavLink to="/admin">{t('nav.admin')}</NavLink>
      )}
      {me.data.role === 'platform_admin' && <NavLink to="/platform">{t('nav.platform')}</NavLink>}
      <NavLink to="/certificates">{t('nav.certificates')}</NavLink>
      <NavLink to="/account">{t('nav.account')}</NavLink>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void signOut()}>
        {t('nav.signOut')}
      </button>
    </>
  );
}

export function Layout() {
  const { t } = useTranslation();
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link to="/" className="brand" aria-label="Lumio">
            <Logo />
          </Link>
          <nav>
            <NavLink to="/courses">{t('nav.catalog')}</NavLink>
            <NavLink to="/sign-up?type=company">{t('nav.business')}</NavLink>
            <LanguageSwitch />
            <AccountNav />
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <span>
            {t('footer.rights', { year: new Date().getFullYear() })} · {t('footer.tagline')} ·{' '}
            <Link to="/dogrula">{t('nav.verify')}</Link>
          </span>
          <StatusLine />
        </div>
      </footer>
    </>
  );
}
