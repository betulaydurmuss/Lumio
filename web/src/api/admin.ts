import {
  auditEntrySchema,
  invitationPreviewSchema,
  invitationSchema,
  memberSchema,
  orgStatsSchema,
  platformCourseSchema,
  platformOverviewSchema,
  type AcceptInvitationInput,
  type AssignableRole,
  type InviteInput,
} from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from './catalog.js';
import { api } from './client.js';

export const useOrgStats = () =>
  useQuery({
    queryKey: ['org', 'stats'],
    queryFn: () => api('GET', '/api/org/stats', { schema: orgStatsSchema }),
    retry: false,
  });

export const useMembers = () =>
  useQuery({
    queryKey: ['org', 'members'],
    queryFn: () => api('GET', '/api/org/members', { schema: memberSchema.array() }),
    retry: false,
  });

export const useInvitations = () =>
  useQuery({
    queryKey: ['org', 'invitations'],
    queryFn: () => api('GET', '/api/org/invitations', { schema: invitationSchema.array() }),
    retry: false,
  });

export const useAuditLog = () =>
  useQuery({
    queryKey: ['org', 'audit'],
    queryFn: () => api('GET', '/api/org/audit-logs', { schema: auditEntrySchema.array() }),
    retry: false,
  });

/** Every member action refreshes the whole organization view: counts change too. */
function useOrgMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org'] }),
  });
}

export const useInvite = () =>
  useOrgMutation((input: InviteInput) => api('POST', '/api/org/invitations', { body: input }));

export const useCancelInvitation = () =>
  useOrgMutation((id: string) =>
    api<void>('DELETE', `/api/org/invitations/${encodeURIComponent(id)}`),
  );

export const useChangeRole = () =>
  useOrgMutation(({ id, role }: { id: string; role: AssignableRole }) =>
    api<void>('PATCH', `/api/org/members/${encodeURIComponent(id)}/role`, { body: { role } }),
  );

export const useSetMemberActive = () =>
  useOrgMutation(({ id, active }: { id: string; active: boolean }) =>
    api<void>(
      'POST',
      `/api/org/members/${encodeURIComponent(id)}/${active ? 'reactivate' : 'deactivate'}`,
    ),
  );

export const useInvitationPreview = (token: string) =>
  useQuery({
    queryKey: ['invitation', token],
    queryFn: () =>
      api('POST', '/api/auth/invitations/lookup', {
        body: { token },
        schema: invitationPreviewSchema,
      }),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });

export const useAcceptInvitation = () =>
  useMutation({
    mutationFn: (input: AcceptInvitationInput) =>
      api('POST', '/api/auth/invitations/accept', { body: input }),
  });

export const usePlatformOverview = () =>
  useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: () => api('GET', '/api/platform/overview', { schema: platformOverviewSchema }),
    retry: false,
  });

export function usePlatformCourses() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['platform', 'courses', locale],
    queryFn: () =>
      api('GET', `/api/platform/courses?locale=${locale}`, {
        schema: platformCourseSchema.array(),
      }),
    retry: false,
  });
}

export function useSetCourseStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: 'draft' | 'published' }) =>
      api<void>('PATCH', `/api/platform/courses/${encodeURIComponent(slug)}/status`, {
        body: { status },
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]),
  });
}
