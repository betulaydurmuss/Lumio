import {
  catalogPageSchema,
  categoryNodeSchema,
  courseCardSchema,
  courseDetailSchema,
  learningItemSchema,
  suggestionsSchema,
  type Locale,
} from '@lumio/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from './client.js';

export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage === 'en' ? 'en' : 'tr';
}

export function useCategories() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['categories', locale],
    queryFn: () =>
      api('GET', `/api/catalog/categories?locale=${locale}`, {
        schema: categoryNodeSchema.array(),
      }),
    staleTime: 5 * 60_000,
  });
}

/** `params` is the page's own query string, so the URL stays the single source of truth. */
export function useCatalog(params: URLSearchParams) {
  const locale = useLocale();
  const query = new URLSearchParams(params);
  query.set('locale', locale);
  const key = query.toString();
  return useQuery({
    queryKey: ['catalog', key],
    queryFn: () => api('GET', `/api/catalog/courses?${key}`, { schema: catalogPageSchema }),
    placeholderData: keepPreviousData,
  });
}

export function useSuggestions(q: string, enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['suggest', locale, q],
    queryFn: () =>
      api('GET', `/api/catalog/suggest?locale=${locale}&q=${encodeURIComponent(q)}`, {
        schema: suggestionsSchema,
      }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useCourse(slug: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['course', slug, locale],
    queryFn: () =>
      api('GET', `/api/catalog/courses/${encodeURIComponent(slug)}?locale=${locale}`, {
        schema: courseDetailSchema,
      }),
    retry: false,
  });
}

export function useLearning(enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['learning', locale],
    queryFn: () =>
      api('GET', `/api/me/learning?locale=${locale}`, { schema: learningItemSchema.array() }),
    enabled,
  });
}

export function useWishlist(enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['wishlist', locale],
    queryFn: () =>
      api('GET', `/api/me/wishlist?locale=${locale}`, { schema: courseCardSchema.array() }),
    enabled,
  });
}

export function useCourseActions(slug: string) {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course', slug] }),
      queryClient.invalidateQueries({ queryKey: ['learning'] }),
      queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
    ]);
  };
  const path = `/api/catalog/courses/${encodeURIComponent(slug)}`;

  return {
    enroll: useMutation({ mutationFn: () => api('POST', `${path}/enroll`), onSuccess: refresh }),
    wishlist: useMutation({
      mutationFn: (save: boolean) => api<void>(save ? 'PUT' : 'DELETE', `${path}/wishlist`),
      onSuccess: refresh,
    }),
  };
}
