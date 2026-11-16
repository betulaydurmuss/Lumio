import { z } from 'zod';

export const locales = ['tr', 'en'] as const;
export const defaultLocale = 'tr';

export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;
