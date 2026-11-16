import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="empty-state">
      <div className="wrap">
        <h2>{t('notFound.title')}</h2>
        <p>{t('notFound.body')}</p>
        <Link to="/" className="btn btn-primary">
          {t('notFound.back')}
        </Link>
      </div>
    </section>
  );
}
