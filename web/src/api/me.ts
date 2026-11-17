import {
  consentsSchema,
  notificationFeedSchema,
  type MarkReadInput,
  type UpdateConsentsInput,
} from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';

const feedKey = ['notifications'] as const;

/** Checked once a minute while signed in, so new notices show up without a reload. */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: feedKey,
    queryFn: () => api('GET', '/api/me/notifications', { schema: notificationFeedSchema }),
    enabled,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarkReadInput) =>
      api<void>('POST', '/api/me/notifications/read', { body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

export function useConsents() {
  return useQuery({
    queryKey: ['consents'],
    queryFn: () => api('GET', '/api/me/consents', { schema: consentsSchema }),
  });
}

export function useUpdateConsents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateConsentsInput) =>
      api('PUT', '/api/me/consents', { body: input, schema: consentsSchema }),
    onSuccess: (data) => queryClient.setQueryData(['consents'], data),
  });
}

/** A plain download: the browser sends the session cookie itself. */
export const DATA_EXPORT_HREF = '/api/me/data-export';
