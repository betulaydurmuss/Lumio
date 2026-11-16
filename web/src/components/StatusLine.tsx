import { healthResponseSchema, type HealthResponse } from '@lumio/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
  // A 503 still carries a valid body describing which dependency is down.
  if (!res.ok && res.status !== 503) throw new Error(`health ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}

export function StatusLine() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const state = health.isPending ? 'checking' : health.isError ? 'down' : health.data.status;

  return (
    <span className="status-line" role="status">
      <span className="status-dot" data-state={state} aria-hidden="true" />
      {t(`status.${state}`)}
    </span>
  );
}
