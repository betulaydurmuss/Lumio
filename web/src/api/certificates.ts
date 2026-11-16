import { orgCertificateSchema, ownCertificateSchema, verificationSchema } from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from './catalog.js';
import { api } from './client.js';

const base = (certNo: string) => `/api/certificates/${encodeURIComponent(certNo)}`;

export function documentUrl(certNo: string, code: string, kind: 'pdf' | 'png', width?: number) {
  const params = new URLSearchParams({ k: code });
  if (width) params.set('w', String(width));
  return `${base(certNo)}/certificate.${kind}?${params}`;
}

export function verifyPageUrl(certNo: string, code: string) {
  return `${window.location.origin}/dogrula/${certNo}?k=${encodeURIComponent(code)}`;
}

export function useVerification(certNo: string | undefined, code: string | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['verify', certNo, code, locale],
    queryFn: () => {
      const params = new URLSearchParams({ locale });
      if (code) params.set('k', code);
      return api('GET', `${base(certNo ?? '')}?${params}`, { schema: verificationSchema });
    },
    enabled: Boolean(certNo),
    retry: false,
  });
}

export function useMyCertificates(enabled = true) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['certificates', locale],
    queryFn: () =>
      api('GET', `/api/me/certificates?locale=${locale}`, { schema: ownCertificateSchema.array() }),
    enabled,
  });
}

export function useOrgCertificates() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['org', 'certificates', locale],
    queryFn: () =>
      api('GET', `/api/org/certificates?locale=${locale}`, {
        schema: orgCertificateSchema.array(),
      }),
    retry: false,
  });
}

export function useRevokeCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ certNo, reason }: { certNo: string; reason: string }) =>
      api<void>('POST', `${base(certNo)}/revoke`, { body: { reason } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org', 'certificates'] }),
  });
}
