// A short list of the most common throwaway mail providers. It is a speed bump,
// not a wall; email verification is what actually proves an address works.
const disposableDomains = new Set([
  '10minutemail.com',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@').pop()?.toLowerCase() ?? '';
  return disposableDomains.has(domain);
}
