import {
  auditEntrySchema,
  loginResultSchema,
  memberSchema,
  meSchema,
  sessionSchema,
  totpSetupSchema,
  type LoginInput,
  type Me,
  type RegisterInput,
  type ResetPasswordInput,
} from '@lumio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client.js';

export const meQueryKey = ['me'] as const;

/** The signed-in user, or null when nobody is signed in. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<Me | null> => {
      try {
        return await api('GET', '/api/auth/me', { schema: meSchema });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useRefreshMe() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: meQueryKey });
}

export const authApi = {
  register: (input: RegisterInput) => api('POST', '/api/auth/register', { body: input }),
  verifyEmail: (token: string) => api('POST', '/api/auth/verify-email', { body: { token } }),
  forgotPassword: (email: string) => api('POST', '/api/auth/password/forgot', { body: { email } }),
  resetPassword: (input: ResetPasswordInput) =>
    api('POST', '/api/auth/password/reset', { body: input }),
  login: (input: LoginInput) =>
    api('POST', '/api/auth/login', { body: input, schema: loginResultSchema }),
  loginTotp: (code: string) =>
    api('POST', '/api/auth/login/totp', { body: { code }, schema: loginResultSchema }),
  logout: () => api<void>('POST', '/api/auth/logout'),
  sessions: () => api('GET', '/api/auth/sessions', { schema: sessionSchema.array() }),
  revokeSession: (id: string) =>
    api<void>('DELETE', `/api/auth/sessions/${encodeURIComponent(id)}`),
  totpSetup: (password: string) =>
    api('POST', '/api/auth/totp/setup', { body: { password }, schema: totpSetupSchema }),
  totpEnable: (code: string) => api('POST', '/api/auth/totp/enable', { body: { code } }),
  members: () => api('GET', '/api/org/members', { schema: memberSchema.array() }),
  auditLogs: () => api('GET', '/api/org/audit-logs', { schema: auditEntrySchema.array() }),
};
