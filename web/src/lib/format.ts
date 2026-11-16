import type { Locale, Price } from '@lumio/shared';

const intlLocale = (locale: Locale) => (locale === 'tr' ? 'tr-TR' : 'en-GB');

/** Whole liras without decimals (₺249), kuruş only when there are any (₺249,50). */
export function formatMoney(amount: number, currency: string, locale: Locale): string {
  const value = amount / 100;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isFree(price: Price): boolean {
  return price.amount === 0;
}

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** 95 → "1 sa 35 dk" / "1 h 35 min"; under an hour stays in minutes. */
export function formatDuration(minutes: number, locale: Locale): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = locale === 'tr' ? 'sa' : 'h';
  const m = locale === 'tr' ? 'dk' : 'min';
  if (hours === 0) return `${rest} ${m}`;
  return rest === 0 ? `${hours} ${h}` : `${hours} ${h} ${rest} ${m}`;
}

export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(
    new Date(value),
  );
}
