import type { Locale, MailJob } from '@lumio/shared';

const copy = {
  tr: {
    subject: 'Lumio hesabını doğrula',
    greeting: 'Merhaba,',
    body: 'Lumio hesabını etkinleştirmek için aşağıdaki bağlantıyı aç. Bağlantı 24 saat geçerli.',
    ignore: 'Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.',
  },
  en: {
    subject: 'Verify your Lumio account',
    greeting: 'Hello,',
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

/**
 * Goes to an address nobody has proved yet, so it carries none of the
 * registrant's own words: a name typed at sign-up could be any sentence.
 */
export function verificationMail(params: { to: string; link: string; locale: Locale }): MailJob {
  const t = copy[params.locale];
  const text = [t.greeting, '', t.body, '', params.link, '', t.ignore].join('\n');
  const html = `<p>${escapeHtml(t.greeting)}</p>
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

const assignmentCopy = {
  tr: {
    subject: (course: string) => `Yeni eğitim: ${course}`,
    body: (course: string) => `Kurumun sana Lumio'da "${course}" eğitimini atadı.`,
    due: (date: string) => `Son tarih: ${date}.`,
    open: 'Eğitime başlamak için aşağıdaki bağlantıyı aç ve Lumio hesabınla giriş yap.',
  },
  en: {
    subject: (course: string) => `New training: ${course}`,
    body: (course: string) => `Your organization assigned you "${course}" on Lumio.`,
    due: (date: string) => `Due date: ${date}.`,
    open: 'Open the link below and sign in with your Lumio account to start.',
  },
} as const;

/**
 * Tells a member a course was assigned to them. Only the catalog's own course
 * title and the date appear: nothing an admin typed travels in this mail.
 */
export function assignmentMail(params: {
  to: string;
  courseTitle: string;
  dueOn: string | null;
  link: string;
  locale: Locale;
}): MailJob {
  const t = assignmentCopy[params.locale];
  const lines = [
    t.body(params.courseTitle),
    ...(params.dueOn ? [t.due(params.dueOn)] : []),
    t.open,
  ];
  const text = [...lines, '', params.link].join('\n');
  const html = `${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
<p><a href="${escapeHtml(params.link)}">${escapeHtml(params.link)}</a></p>`;
  return { to: params.to, subject: t.subject(params.courseTitle), text, html };
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
