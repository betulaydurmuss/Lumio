import type { CatalogPage, PlatformCategory, PlatformCourseDetail } from '@lumio/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import {
  buildApp,
  Client,
  resetDatabase,
  signedInAdmin,
  testPrisma,
  type TestContext,
} from './helpers.js';

const COURSE = 'kvkk-awareness';
let ctx: TestContext;

beforeAll(async () => {
  await seedCatalog(testPrisma());
});

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

// The catalog is shared by every test file: put the demo content back.
afterAll(async () => {
  const prisma = testPrisma();
  await prisma.course.updateMany({ data: { editedAt: null } });
  await prisma.category.updateMany({ data: { editedAt: null } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await seedCatalog(prisma);
});

async function operator() {
  const admin = await signedInAdmin(ctx, 'Lumio Operasyon');
  await ctx.prisma.user.update({ where: { id: admin.user.id }, data: { role: 'platform_admin' } });
  return admin.client;
}

const put = (client: Client, url: string, body: object) =>
  client.agent.put(url).set('x-csrf-token', client.csrf).send(body);
const patch = (client: Client, url: string, body: object) =>
  client.agent.patch(url).set('x-csrf-token', client.csrf).send(body);

describe('editing a course', () => {
  it('changes what the catalog shows and finds it by its new words', async () => {
    const client = await operator();
    const detail = (await client.get(`/api/platform/courses/${COURSE}`))
      .body as PlatformCourseDetail;
    expect(detail.editedAt).toBeNull();

    const res = await put(client, `/api/platform/courses/${COURSE}`, {
      ...detail,
      titleEn: 'Personal data protection for everyone',
      subtitleEn: 'Zeppelin edition',
    });
    expect(res.status).toBe(204);

    const page = await request(ctx.app).get(`/api/catalog/courses/${COURSE}?locale=en`);
    expect(page.body.title).toBe('Personal data protection for everyone');
    const found = (await request(ctx.app).get('/api/catalog/courses?q=zeppelin&locale=en'))
      .body as CatalogPage;
    expect(found.items.map((item) => item.slug)).toEqual([COURSE]);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'course.updated' } })).toBe(1);
  });

  it('keeps the edit when the demo seed runs again on the next deploy', async () => {
    const client = await operator();
    const detail = (await client.get(`/api/platform/courses/${COURSE}`))
      .body as PlatformCourseDetail;
    await put(client, `/api/platform/courses/${COURSE}`, {
      ...detail,
      titleTr: 'Herkes için KVKK',
    });

    await seedCatalog(ctx.prisma);
    const course = await ctx.prisma.course.findUniqueOrThrow({ where: { slug: COURSE } });
    expect(course.titleTr).toBe('Herkes için KVKK');
  });

  it('refuses line breaks in a title and an unknown category', async () => {
    const client = await operator();
    const detail = (await client.get(`/api/platform/courses/${COURSE}`))
      .body as PlatformCourseDetail;
    const broken = await put(client, `/api/platform/courses/${COURSE}`, {
      ...detail,
      titleEn: 'Line one\nLine two',
    });
    expect(broken.status).toBe(400);
    const lost = await put(client, `/api/platform/courses/${COURSE}`, {
      ...detail,
      categorySlug: 'no-such-category',
    });
    expect(lost.status).toBe(422);
  });

  it('is for platform admins only', async () => {
    const orgAdmin = await signedInAdmin(ctx);
    expect((await orgAdmin.client.get(`/api/platform/courses/${COURSE}`)).status).toBe(403);
    expect((await put(orgAdmin.client, `/api/platform/courses/${COURSE}`, {})).status).toBe(403);
  });
});

describe('categories', () => {
  it('adds a subcategory, renames it, and removes it once empty', async () => {
    const client = await operator();
    const created = await client.post('/api/platform/categories', {
      slug: 'test-cloud',
      nameTr: 'Bulut Güvenliği',
      nameEn: 'Cloud Security',
      parentSlug: 'cybersecurity',
    });
    expect(created.status).toBe(201);

    const tree = (await client.get('/api/platform/categories')).body as PlatformCategory[];
    expect(tree.find((row) => row.slug === 'test-cloud')).toMatchObject({
      parentSlug: 'cybersecurity',
      courses: 0,
    });

    expect(
      (
        await patch(client, '/api/platform/categories/test-cloud', {
          nameTr: 'Bulut',
          nameEn: 'Cloud',
        })
      ).status,
    ).toBe(204);
    expect((await client.delete('/api/platform/categories/test-cloud')).status).toBe(204);
  });

  it('refuses a third level, a taken address and deleting a category in use', async () => {
    const client = await operator();
    const tooDeep = await client.post('/api/platform/categories', {
      slug: 'test-deep',
      nameTr: 'Derin',
      nameEn: 'Deep',
      parentSlug: 'kvkk',
    });
    expect(tooDeep.status).toBe(422);
    const taken = await client.post('/api/platform/categories', {
      slug: 'compliance',
      nameTr: 'Uyum',
      nameEn: 'Compliance',
      parentSlug: null,
    });
    expect(taken.status).toBe(409);
    const inUse = await client.delete('/api/platform/categories/kvkk');
    expect(inUse.status).toBe(409);
  });

  it('keeps courses findable by a renamed category', async () => {
    const client = await operator();
    await patch(client, '/api/platform/categories/kvkk', {
      nameTr: 'Kişisel Veri Zeplini',
      nameEn: 'Personal Data Zeppelin',
    });
    const found = (await request(ctx.app).get('/api/catalog/courses?q=zeplini&locale=tr'))
      .body as CatalogPage;
    expect(found.items.map((item) => item.slug)).toContain(COURSE);
  });
});
