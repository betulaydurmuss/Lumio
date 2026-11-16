import type { Locale, MailJob } from '@lumio/shared';

const copy = {
  tr: {
    subject: 'Lumio hesabını doğrula',
    greeting: (name: string) => `Merhaba ${name},`,
    body: 'Lumio hesabını etkinleştirmek için aşağıdaki bağlantıyı aç. Bağlantı 24 saat geçerli.',
    ignore: 'Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.',
  },
  en: {
    subject: 'Verify your Lumio account',
    greeting: (name: string) => `Hello ${name},`,
    body: 'Open the link below to activate your Lumio account. The link is valid for 24 hours.',
    ignore: 'If you did not create this account, you can ignore this email.',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function verificationMail(params: {
  to: string;
  name: string;
  link: string;
  locale: Locale;
}): MailJob {
  const t = copy[params.locale];
  const text = [t.greeting(params.name), '', t.body, '', params.link, '', t.ignore].join('\n');
  const html = `<p>${escapeHtml(t.greeting(params.name))}</p>
<p>${escapeHtml(t.body)}</p>
<p><a href="${escapeHtml(params.link)}">${escapeHtml(params.link)}</a></p>
<p style="color:#6B7280">${escapeHtml(t.ignore)}</p>`;
  return { to: params.to, subject: t.subject, text, html };
}
