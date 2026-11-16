import type { OwnCertificate } from '@lumio/shared';
import { Award, Check, Copy, Download, ExternalLink, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { documentUrl, useMyCertificates, verifyPageUrl } from '../api/certificates.js';
import { useLocale } from '../api/catalog.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

/** LinkedIn's "add a licence or certification" form, filled in. */
function linkedInUrl(certificate: OwnCertificate) {
  const issued = new Date(certificate.issuedAt);
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: certificate.courseTitle,
    organizationName: 'Lumio',
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: verifyPageUrl(certificate.certNo, certificate.verifyCode),
    certId: certificate.certNo,
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

function CertificateCard({ certificate }: { certificate: OwnCertificate }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const link = verifyPageUrl(certificate.certNo, certificate.verifyCode);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the verification page link still works.
    }
  }

  return (
    <article className="card certificate-card">
      <Link to={`/dogrula/${certificate.certNo}?k=${encodeURIComponent(certificate.verifyCode)}`}>
        <img
          src={documentUrl(certificate.certNo, certificate.verifyCode, 'png', 800)}
          alt=""
          width={800}
          height={566}
          loading="lazy"
        />
      </Link>
      <div className="certificate-body">
        <h3>{certificate.courseTitle}</h3>
        <p className="hint mono">
          {certificate.certNo} ·{' '}
          {t('certificates.issuedOn', {
            date: new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
              dateStyle: 'long',
            }).format(new Date(certificate.issuedAt)),
          })}
        </p>
        {certificate.revoked && (
          <span className="badge badge-soft">{t('certificates.revoked')}</span>
        )}
        <div className="certificate-actions">
          <a
            className="btn btn-accent btn-sm"
            href={documentUrl(certificate.certNo, certificate.verifyCode, 'pdf')}
          >
            <Download size={15} aria-hidden="true" />
            PDF
          </a>
          <a
            className="btn btn-secondary btn-sm"
            href={documentUrl(certificate.certNo, certificate.verifyCode, 'png', 3508)}
            download={`${certificate.certNo}.png`}
          >
            <Download size={15} aria-hidden="true" />
            PNG
          </a>
          <Link
            className="btn btn-secondary btn-sm"
            to={`/dogrula/${certificate.certNo}?k=${encodeURIComponent(certificate.verifyCode)}`}
          >
            <ExternalLink size={15} aria-hidden="true" />
            {t('certificates.view')}
          </Link>
          {!certificate.revoked && (
            <a
              className="btn btn-secondary btn-sm"
              href={linkedInUrl(certificate)}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={15} aria-hidden="true" />
              {t('certificates.linkedin')}
            </a>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy()}>
            {copied ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}
            {copied ? t('certificates.copied') : t('certificates.copyLink')}
          </button>
        </div>
      </div>
    </article>
  );
}

export function CertificatesPage() {
  const { t } = useTranslation();
  const certificates = useMyCertificates();

  return (
    <div className="wrap page">
      <header className="page-head">
        <h2>{t('certificates.title')}</h2>
        <p className="lead">{t('certificates.lead')}</p>
      </header>

      {certificates.isPending && <div className="skeleton" style={{ height: 320 }} />}
      {certificates.isError && <ErrorAlert error={certificates.error} />}

      {certificates.data?.length === 0 && (
        <div className="card empty-results">
          <Award size={32} aria-hidden="true" />
          <h3>{t('certificates.emptyTitle')}</h3>
          <p>{t('certificates.emptyBody')}</p>
          <Link to="/courses" className="btn btn-primary">
            {t('certificates.browse')}
          </Link>
        </div>
      )}

      {certificates.data && certificates.data.length > 0 && (
        <div className="certificate-grid">
          {certificates.data.map((certificate) => (
            <CertificateCard key={certificate.certNo} certificate={certificate} />
          ))}
        </div>
      )}
    </div>
  );
}
