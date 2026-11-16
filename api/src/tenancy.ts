import type { PrismaClient } from './db.js';

/** Models whose rows belong to exactly one organization through `orgId`. */
const TENANT_MODELS = new Set(['User', 'Session', 'AuditLog', 'Enrollment', 'WishlistItem']);

const READ_OR_WRITE_BY_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

type Args = Record<string, unknown>;

function scopeWhere(args: Args, orgId: string): Args {
  const where = (args.where as Args | undefined) ?? {};
  // AND keeps any orgId the caller passed from widening the scope.
  return { ...args, where: { AND: [where, { orgId }] } };
}

function scopeUniqueWhere(args: Args, orgId: string): Args {
  // Unique lookups need the unique field at the top level; extra filters are allowed beside it.
  const where = (args.where as Args | undefined) ?? {};
  return { ...args, where: { ...where, orgId } };
}

function scopeData(data: unknown, orgId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => ({ ...(row as Args), orgId }));
  return { ...(data as Args), orgId };
}

/**
 * Returns a client that can only see and write one organization's rows.
 * Request handlers get this client, never the raw one, so a forgotten
 * `where: { orgId }` cannot leak another tenant's data.
 */
export function scopedPrisma(prisma: PrismaClient, orgId: string) {
  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const input = (args ?? {}) as Args;

          if (
            operation === 'create' ||
            operation === 'createMany' ||
            operation === 'createManyAndReturn'
          ) {
            return query({ ...input, data: scopeData(input.data, orgId) } as typeof args);
          }
          if (operation === 'upsert') {
            return query({
              ...scopeUniqueWhere(input, orgId),
              create: scopeData(input.create, orgId),
            } as typeof args);
          }
          if (
            operation.startsWith('findUnique') ||
            operation === 'update' ||
            operation === 'delete'
          ) {
            return query(scopeUniqueWhere(input, orgId) as typeof args);
          }
          if (READ_OR_WRITE_BY_WHERE.has(operation)) {
            return query(scopeWhere(input, orgId) as typeof args);
          }
          throw new Error(`Tenant scope does not handle ${model}.${operation}`);
        },
      },
    },
  });
}

export type ScopedPrisma = ReturnType<typeof scopedPrisma>;
