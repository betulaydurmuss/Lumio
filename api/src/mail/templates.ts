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

const resetCopy = {
  tr: {
    subject: 'Lumio şifreni yenile',
    body: 'Lumio şifreni yenilemek için aşağıdaki bağlantıyı aç. Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir. Yeni şifren kaydedildiğinde tüm cihazlardaki oturumların kapanır.',
    ignore: 'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.',
  },
  en: {
    subject: 'Reset your Lumio password',
    body: 'Open the link below to choose a new Lumio password. The link is valid for 1 hour and can be used once. Saving a new password signs you out on every device.',
    ignore: 'If you did not ask for this, you can ignore this email; your password stays the same.',
  },
} as const;

/** Addressed by email, not by name: the name may have been typed by someone else. */
export function passwordResetMail(params: { to: string; link: string; locale: Locale }): MailJob {
  const t = resetCopy[params.locale];
  const text = [t.body, '', params.link, '', t.ignore].join('\n');
  const html = `<p>${escapeHtml(t.body)}</p>
<p><a href="${escapeHtml(params.link)}">${escapeHtml(params.link)}</a></p>
<p style="color:#6B7280">${escapeHtml(t.ignore)}</p>`;
  return { to: params.to, subject: t.subject, text, html };
}

const invitationCopy = {
  tr: {
    subject: (org: string) => `${org} seni Lumio'ya davet ediyor`,
    body: (org: string, inviter: string) =>
      `${inviter}, seni Lumio'da ${org} ekibine katılmaya davet etti. Hesabını oluşturmak için aşağıdaki bağlantıyı aç. Bağlantı 7 gün geçerli ve yalnızca bir kez kullanılabilir.`,
    ignore: 'Bu daveti beklemiyorsan bu e-postayı yok sayabilirsin.',
  },
  en: {
    subject: (org: string) => `${org} invites you to Lumio`,
    body: (org: string, inviter: string) =>
      `${inviter} invited you to join ${org} on Lumio. Open the link below to create your account. The link is valid for 7 days and can be used once.`,
    ignore: 'If you were not expecting this invitation, you can ignore this email.',
  },
} as const;

/** Sent in both languages: the invitee has not chosen one yet. */
export function invitationMail(params: {
  to: string;
  organization: string;
  inviter: string;
  link: string;
}): MailJob {
  const parts = (['tr', 'en'] as const).map((locale) => invitationCopy[locale]);
  const text = parts
    .map((copy) =>
      [copy.body(params.organization, params.inviter), '', params.link, '', copy.ignore].join('\n'),
    )
    .join('\n\n— — —\n\n');
  const html = parts
    .map(
      (copy) => `<p>${escapeHtml(copy.body(params.organization, params.inviter))}</p>
<p><a href="${escapeHtml(params.link)}">${escapeHtml(params.link)}</a></p>
<p style="color:#6B7280">${escapeHtml(copy.ignore)}</p>`,
    )
    .join('<hr>');
  // Names can be 120 characters; the subject has room for two short ones.
  const org =
    params.organization.length > 50 ? `${params.organization.slice(0, 49)}…` : params.organization;
  return {
    to: params.to,
    subject: `${invitationCopy.tr.subject(org)} · ${invitationCopy.en.subject(org)}`,
    text,
    html,
  };
}
