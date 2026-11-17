import type { Notification } from '@lumio/shared';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLocale } from '../api/catalog.js';
import { useMarkRead, useNotifications } from '../api/me.js';

/** Where a notification leads when it is opened. */
function targetOf(item: Notification): string {
  switch (item.kind) {
    case 'course_assigned':
      return item.data.courseSlug ? `/learn/${item.data.courseSlug}` : '/';
    case 'certificate_issued':
      return '/certificates';
    default:
      return '/account';
  }
}

function useNotificationText() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (item: Notification) => {
    const course = locale === 'tr' ? item.data.courseTitleTr : item.data.courseTitleEn;
    if (item.kind === 'course_assigned' && item.data.dueOn) {
      const due = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(`${item.data.dueOn}T12:00:00`),
      );
      return t('notifications.course_assigned_due', { course, due });
    }
    return t(`notifications.${item.kind}`, { course, certNo: item.data.certNo });
  };
}

export function NotificationBell() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const feed = useNotifications(true);
  const markRead = useMarkRead();
  const text = useNotificationText();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = feed.data?.unread ?? 0;

  // Closes on a click elsewhere or on Escape, like any menu.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openItem(item: Notification) {
    if (!item.read) markRead.mutate({ ids: [item.id] });
    setOpen(false);
    void navigate(targetOf(item));
  }

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="bell-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('notifications.title', { count: unread })}
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="region" aria-label={t('notifications.heading')}>
          <div className="bell-head">
            <strong>{t('notifications.heading')}</strong>
            {unread > 0 && (
              <button type="button" className="btn-link" onClick={() => markRead.mutate({})}>
                {t('notifications.markAll')}
              </button>
            )}
          </div>
          {feed.data?.items.length ? (
            <ul>
              {feed.data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.read ? 'bell-item' : 'bell-item unread'}
                    onClick={() => openItem(item)}
                  >
                    <span>{text(item)}</span>
                    <time dateTime={item.createdAt} className="hint">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(item.createdAt))}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{t('notifications.empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
