import { locales, rolesRequiringTwoFactor, type Locale } from '@lumio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useMatches, useNavigate } from 'react-router';
import { authApi, meQueryKey, useMe } from '../api/auth.js';
import { setLocale } from '../i18n/index.js';
import { pageTitle } from '../lib/usePageTitle.js';
import type { RouteHandle } from '../routes.js';
import { CookieNotice } from './CookieNotice.js';
import { Logo } from './Logo.js';
import { NotificationBell } from './NotificationBell.js';
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
      <NotificationBell />
      <NavLink to="/certificates">{t('nav.certificates')}</NavLink>
      <NavLink to="/transcript">{t('nav.transcript')}</NavLink>
      <NavLink to="/account">{t('nav.account')}</NavLink>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void signOut()}>
        {t('nav.signOut')}
      </button>
    </>
  );
}

/** Sets the tab title for pages whose route names one; the others set their own. */
/**
 * Names the tab on every navigation. Course and lesson pages have no title of
 * their own here and rename the tab once their data arrives; this runs before
 * them in the same commit, so their name wins.
 */
function RouteTitle() {
  const { t } = useTranslation();
  const match = useMatches().at(-1);
  const key = (match?.handle as RouteHandle | undefined)?.title;
  const path = match?.pathname;
  useEffect(() => {
    document.title = pageTitle(key ? t(key) : null);
  }, [key, path, t]);
  return null;
}

export function Layout() {
  const { t } = useTranslation();
  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <RouteTitle />
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
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <span>
            {t('footer.rights', { year: new Date().getFullYear() })} · {t('footer.tagline')} ·{' '}
            <Link to="/dogrula">{t('nav.verify')}</Link> ·{' '}
            <Link to="/privacy">{t('nav.privacy')}</Link>
          </span>
          <StatusLine />
        </div>
      </footer>
      <CookieNotice />
    </>
  );
}
