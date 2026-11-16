// Grants the platform admin role to an existing, verified account.
//
//   npm run admin:promote -w api -- someone@example.com
//   docker compose run --rm migrate npx tsx scripts/make-platform-admin.ts someone@example.com
//
// There is deliberately no API for this: whoever runs it already controls the server.
import { audit } from '../src/audit.js';
import { createPrisma } from '../src/db.js';

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url) {
  console.error('Usage: make-platform-admin <email>   (DATABASE_URL must be set)');
  process.exit(1);
}

const prisma = createPrisma(url);
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account uses ${email}`);
  if (!user.emailVerifiedAt) throw new Error(`${email} has not verified its address yet`);
  if (user.role === 'platform_admin') {
    console.log(`${email} is already a platform admin`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'platform_admin' } });
    await audit(prisma, {
      orgId: user.orgId,
      actorId: null,
      action: 'member.role_changed',
      targetType: 'user',
      targetId: user.id,
      metadata: { from: user.role, to: 'platform_admin', via: 'command line' },
    });
    console.log(
      `${email} is now a platform admin. They must turn on 2FA before the console opens.`,
    );
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
