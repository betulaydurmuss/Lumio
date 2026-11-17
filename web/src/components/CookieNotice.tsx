import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const KEY = 'lumio.cookieNotice';

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Lumio sets only the cookies it needs to work, so there is nothing to accept
 * or refuse. This says so once, plainly, instead of showing a consent banner
 * with choices that would change nothing.
 */
export function CookieNotice() {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(seen);
  if (hidden) return null;

  function close() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Without storage the notice simply shows again next time.
    }
    setHidden(true);
  }

  return (
    <div className="cookie-notice" role="region" aria-label={t('cookies.label')}>
      <p>
        {t('cookies.text')} <Link to="/privacy">{t('cookies.more')}</Link>
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={close}>
        {t('cookies.ok')}
      </button>
    </div>
  );
}
