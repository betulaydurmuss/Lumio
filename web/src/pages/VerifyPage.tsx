import { CERT_NO_PATTERN } from '@lumio/shared';
import {
  Download,
  FileImage,
  KeyRound,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { documentUrl, useVerification } from '../api/certificates.js';
import { useLocale } from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

function longDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function LookupForm({ initial }: { initial: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const normalized = value.trim().toUpperCase();
  const valid = CERT_NO_PATTERN.test(normalized);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) void navigate(`/dogrula/${normalized}`);
  }

  return (
    <form className="verify-form" onSubmit={submit}>
      <label htmlFor="cert-no">{t('verifyPage.certNo')}</label>
      <div className="inline-form">
        <input
          id="cert-no"
          className="input mono"
          placeholder={t('verifyPage.placeholder')}
          value={value}
          maxLength={20}
          autoComplete="off"
          aria-describedby="cert-no-hint"
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!valid}>
          <SearchCheck size={16} aria-hidden="true" />
          {t('verifyPage.check')}
        </button>
      </div>
      <p id="cert-no-hint" className="hint">
        {t('verifyPage.formatHint')}
      </p>
    </form>
  );
}

export function VerifyPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { certNo } = useParams();
  const [params] = useSearchParams();
  const code = params.get('k');
  const verification = useVerification(certNo, code);
  const data = verification.data;
  const notFound = verification.error instanceof ApiError && verification.error.status === 404;

  const status = data?.status;
  const StatusIcon =
    status === 'valid' ? ShieldCheck : status === 'revoked' ? ShieldAlert : ShieldX;

  return (
    <div className="wrap page verify-page">
      <header className="page-head">
        <h2>{t('verifyPage.title')}</h2>
        <p className="lead">{t('verifyPage.lead')}</p>
        <LookupForm key={certNo} initial={certNo ?? ''} />
      </header>

      {certNo && verification.isPending && <div className="skeleton" style={{ height: 240 }} />}

      {notFound && (
        <div className="verify-status invalid" role="status">
          <ShieldX size={28} aria-hidden="true" />
          <div>
            <strong>{t('verifyPage.notFound')}</strong>
            <p>{t('verifyPage.notFoundBody')}</p>
          </div>
        </div>
      )}
      {verification.isError && !notFound && <ErrorAlert error={verification.error} />}

      {data && (
        <div className="verify-result">
          <div className={`verify-status ${data.status}`} role="status">
            <StatusIcon size={28} aria-hidden="true" />
            <div>
              <strong>{t(`verifyPage.${data.status}`)}</strong>
              <p>
                {data.status === 'valid' && t('verifyPage.validBody')}
                {data.status === 'invalid' && t('verifyPage.invalidBody')}
                {data.status === 'revoked' &&
                  t('verifyPage.revokedBody', {
                    date: data.revokedAt ? longDate(data.revokedAt, locale) : '',
                    reason: data.revokedReason ?? '—',
                  })}
              </p>
            </div>
          </div>

          <div className="verify-grid">
            <dl className="card verify-details">
              <div>
                <dt>{t('verifyPage.certNo')}</dt>
                <dd className="mono">{data.certNo}</dd>
              </div>
              <div>
                <dt>{t('verifyPage.recipient')}</dt>
                <dd>
                  <strong>{data.recipientName}</strong>
                  {data.nameMasked && <span className="hint">{t('verifyPage.maskedNote')}</span>}
                </dd>
              </div>
              <div>
                <dt>{t('verifyPage.course')}</dt>
                <dd>{data.courseTitle}</dd>
              </div>
              {data.orgName && (
                <div>
                  <dt>{t('verifyPage.organization')}</dt>
                  <dd>{data.orgName}</dd>
                </div>
              )}
              <div>
                <dt>{t('verifyPage.instructor')}</dt>
                <dd>{data.instructorName}</dd>
              </div>
              <div>
                <dt>{t('verifyPage.duration')}</dt>
                <dd>{t('verifyPage.hours', { count: data.hours })}</dd>
              </div>
              <div>
                <dt>{t('verifyPage.period')}</dt>
                <dd>
                  {longDate(data.startedAt, locale)} – {longDate(data.completedAt, locale)}
                </dd>
              </div>
              <div>
                <dt>{t('verifyPage.issued')}</dt>
                <dd>{longDate(data.issuedAt, locale)}</dd>
              </div>
              <div>
                <dt>{t('verifyPage.signature')}</dt>
                <dd className={data.signature.valid ? 'signature-ok' : 'signature-bad'}>
                  <KeyRound size={14} aria-hidden="true" />{' '}
                  {t(
                    data.signature.valid
                      ? 'verifyPage.signatureValid'
                      : 'verifyPage.signatureInvalid',
                    {
                      algorithm: data.signature.algorithm,
                      keyId: data.signature.keyId,
                    },
                  )}
                </dd>
              </div>
            </dl>

            {code && data.status !== 'invalid' && (
              <figure className="verify-preview">
                <img
                  src={documentUrl(data.certNo, code, 'png', 1600)}
                  alt={t('verifyPage.preview')}
                  width={1600}
                  height={1131}
                />
                <figcaption className="inline-form">
                  <a className="btn btn-accent" href={documentUrl(data.certNo, code, 'pdf')}>
                    <Download size={16} aria-hidden="true" />
                    {t('verifyPage.downloadPdf')}
                  </a>
                  <a
                    className="btn btn-secondary"
                    href={documentUrl(data.certNo, code, 'png', 3508)}
                    download={`${data.certNo}.png`}
                  >
                    <FileImage size={16} aria-hidden="true" />
                    {t('verifyPage.downloadPng')}
                  </a>
                </figcaption>
              </figure>
            )}
          </div>
        </div>
      )}

      <section className="card verify-how">
        <h3>{t('verifyPage.howTitle')}</h3>
        <p>
          {t('verifyPage.howBody')}{' '}
          <a href="/api/certificates/keys" target="_blank" rel="noreferrer">
            {t('verifyPage.keysLink')}
          </a>
        </p>
      </section>
    </div>
  );
}
