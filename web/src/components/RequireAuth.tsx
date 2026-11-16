import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/auth.js';
import { ErrorAlert } from './ErrorAlert.js';

export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="wrap page" aria-busy="true">
      <span className="visually-hidden">{t('common.loading')}</span>
      <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 160 }} />
    </div>
  );
}

/** Renders the nested routes for a signed-in user; sends everyone else to sign in. */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <PageSkeleton />;
  if (me.isError) {
    return (
      <div className="wrap page">
        <ErrorAlert error={me.error} />
      </div>
    );
  }
  if (!me.data) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
