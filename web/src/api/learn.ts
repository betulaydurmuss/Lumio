import {
  courseOutlineSchema,
  lessonViewSchema,
  progressResultSchema,
  quizResultSchema,
  quizViewSchema,
  type ProgressUpdate,
} from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from './catalog.js';
import { api } from './client.js';

export function useOutline(slug: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['outline', slug, locale],
    queryFn: () =>
      api('GET', `/api/learn/${encodeURIComponent(slug)}?locale=${locale}`, {
        schema: courseOutlineSchema,
      }),
    retry: false,
  });
}

export function useLesson(slug: string, lessonId: string | undefined) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['lesson', slug, lessonId, locale],
    queryFn: () =>
      api(
        'GET',
        `/api/learn/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(lessonId ?? '')}?locale=${locale}`,
        { schema: lessonViewSchema },
      ),
    enabled: Boolean(lessonId),
    retry: false,
    // The signed media link inside is valid for hours; no need to refetch on every focus.
    staleTime: 10 * 60_000,
  });
}

export function useSaveProgress(slug: string, lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: ProgressUpdate) =>
      api(
        'PUT',
        `/api/learn/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(lessonId)}/progress`,
        { body: update, schema: progressResultSchema },
      ),
    onSuccess: async (result) => {
      if (result.completed) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['outline', slug] }),
          queryClient.invalidateQueries({ queryKey: ['learning'] }),
        ]);
      }
    },
  });
}

export function useQuiz(slug: string, quizId: string | undefined) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['quiz', slug, quizId, locale],
    queryFn: () =>
      api(
        'GET',
        `/api/learn/${encodeURIComponent(slug)}/quizzes/${encodeURIComponent(quizId ?? '')}?locale=${locale}`,
        { schema: quizViewSchema },
      ),
    enabled: Boolean(quizId),
    retry: false,
  });
}

export function useSubmitQuiz(slug: string, quizId: string) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: number[]) =>
      api(
        'POST',
        `/api/learn/${encodeURIComponent(slug)}/quizzes/${encodeURIComponent(quizId)}/attempts?locale=${locale}`,
        { body: { answers }, schema: quizResultSchema },
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['outline', slug] }),
        queryClient.invalidateQueries({ queryKey: ['quiz', slug, quizId] }),
        queryClient.invalidateQueries({ queryKey: ['learning'] }),
      ]),
  });
}
