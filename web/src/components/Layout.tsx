import { locales, type Locale } from '@lumio/shared';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
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
            <NavLink to="/business">{t('nav.business')}</NavLink>
            <LanguageSwitch />
            <Link to="/sign-in" className="btn btn-primary btn-sm">
              {t('nav.signIn')}
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <span>
            {t('footer.rights', { year: new Date().getFullYear() })} · {t('footer.tagline')}
          </span>
          <StatusLine />
        </div>
      </footer>
    </>
  );
}
