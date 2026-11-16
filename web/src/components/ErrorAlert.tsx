import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';

const KNOWN = new Set([
  'invalid_credentials',
  'email_not_verified',
  'disposable_email',
  'invalid_token',
  'invalid_code',
  'challenge_expired',
  'rate_limited',
  'csrf_failed',
  'mfa_required',
  'forbidden',
  'invalid_input',
  'totp_already_enabled',
  'payment_required',
  'not_found',
  'not_enrolled',
  'not_watched',
  'quiz_locked',
  'invalid_link',
  'invalid_certificate',
  'attempt_limit',
  'cannot_change_self',
  'last_admin',
  'not_a_company',
  'email_taken',
]);

export function errorKey(error: unknown): string {
  return error instanceof ApiError && KNOWN.has(error.code) ? error.code : 'unknown';
}

export function ErrorAlert({ error, children }: { error: unknown; children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="alert alert-danger" role="alert">
      <CircleAlert size={18} className="ic" aria-hidden="true" />
      <div>
        {t(`errors.${errorKey(error)}`)}
        {children}
      </div>
    </div>
  );
}
