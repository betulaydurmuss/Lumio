import {
  assignmentSchema,
  assignResultSchema,
  transcriptSchema,
  type AssignCourseInput,
} from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from './catalog.js';
import { api } from './client.js';

export function useAssignments() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['org', 'assignments', locale],
    queryFn: () =>
      api('GET', `/api/org/assignments?locale=${locale}`, { schema: assignmentSchema.array() }),
    retry: false,
  });
}

/** The CSV report is a plain download: the browser sends the session cookie itself. */
export function useAssignmentsCsvHref() {
  return `/api/org/assignments.csv?locale=${useLocale()}`;
}

export function useAssign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignCourseInput) =>
      api('POST', '/api/org/assignments', { body: input, schema: assignResultSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org'] }),
  });
}

export function useRemoveAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>('DELETE', `/api/org/assignments/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org'] }),
  });
}

/** The signed-in learner's transcript, or a member's when an admin passes their id. */
export function useTranscript(memberId?: string) {
  const locale = useLocale();
  const path = memberId
    ? `/api/org/members/${encodeURIComponent(memberId)}/transcript`
    : '/api/me/transcript';
  return useQuery({
    queryKey: ['transcript', memberId ?? 'me', locale],
    queryFn: () => api('GET', `${path}?locale=${locale}`, { schema: transcriptSchema }),
    retry: false,
  });
}
