import type { CatalogPage, CategoryNode, CourseCard, CourseDetail } from '@lumio/shared';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import { scopedPrisma } from '../src/tenancy.js';
import {
  buildApp,
  Client,
  resetDatabase,
  signedInUser,
  testPrisma,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  await seedCatalog(testPrisma());
});

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

async function list(query: string): Promise<CatalogPage> {
  const res = await request(ctx.app).get(`/api/catalog/courses?${query}`);
  expect(res.status).toBe(200);
  return res.body as CatalogPage;
}

const slugs = (page: CatalogPage) => page.items.map((course) => course.slug);

describe('the catalog', () => {
  it('lists published courses in pages of twelve, most popular first', async () => {
    const page = await list('');

    expect(page.total).toBe(12);
    expect(page.items).toHaveLength(12);
    const counts = page.items.map((course) => course.enrollmentCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('hides drafts from the list and from their own page', async () => {
    const template = await ctx.prisma.course.findFirstOrThrow({ include: { category: true } });
    await ctx.prisma.course.upsert({
      where: { slug: 'unfinished-draft' },
      update: {},
      create: {
        slug: 'unfinished-draft',
        status: 'draft',
        categoryId: template.categoryId,
        instructorId: template.instructorId,
        titleTr: 'Taslak',
        titleEn: 'Draft',
        subtitleTr: '',
        subtitleEn: '',
        descriptionTr: '',
        descriptionEn: '',
        level: 'all',
        language: 'tr',
        searchText: 'taslak draft',
      },
    });

    expect(slugs(await list('q=taslak'))).toEqual([]);
    expect((await request(ctx.app).get('/api/catalog/courses/unfinished-draft')).status).toBe(404);
  });

  it('answers in the requested language', async () => {
    const tr = await list('q=oltalama&locale=tr');
    const en = await list('q=oltalama&locale=en');

    expect(tr.items[0]?.title).toBe('Oltalama ve Sosyal Mühendislik');
    expect(en.items[0]?.title).toBe('Phishing and Social Engineering');
    expect(en.items[0]?.category.name).toBe('Security Awareness');
  });

  it('finds Turkish words typed without Turkish letters, in either language', async () => {
    const plain = slugs(await list('q=guvenlik'));
    const turkish = slugs(await list('q=GÜVENLİK'));

    expect(plain.length).toBeGreaterThan(0);
    expect(turkish).toEqual(plain);
    expect(slugs(await list('q=breach'))).toEqual(['kvkk-data-breach-72-hours']);
  });

  it('needs every word of a multi-word search', async () => {
    expect(slugs(await list('q=kvkk ihlali'))).toEqual(['kvkk-data-breach-72-hours']);
  });

  it('includes subcategories when filtering by a parent category', async () => {
    const compliance = await list('category=compliance');
    const kvkk = await list('category=kvkk');

    expect(compliance.total).toBe(4);
    expect(kvkk.total).toBe(3);
    expect((await list('category=no-such-category')).total).toBe(0);
  });

  it('applies the price, level, language, duration, rating and certificate filters', async () => {
    const free = await list('price=free');
    expect(free.items.every((course) => course.price.amount === 0)).toBe(true);
    expect(free.total).toBe(4);

    const english = await list('language=en');
    expect(english.items.every((course) => course.language === 'en')).toBe(true);

    const advanced = await list('level=advanced');
    expect(slugs(advanced)).toEqual(['kvkk-data-breach-72-hours']);

    const short = await list('duration=short');
    expect(short.items.every((course) => course.durationMinutes <= 120)).toBe(true);

    const topRated = await list('rating=4.9');
    expect(topRated.items.every((course) => course.ratingAverage >= 4.9)).toBe(true);

    expect((await list('certificate=true')).total).toBe(12);
  });

  it('sorts by newest and by rating', async () => {
    const newest = await list('sort=newest');
    expect(newest.items[0]?.slug).toBe('kvkk-privacy-notice-and-consent');
    expect(newest.items[0]?.isNew).toBe(true);

    const rating = (await list('sort=rating')).items.map((course) => course.ratingAverage);
    expect(rating).toEqual([...rating].sort((a, b) => b - a));
  });

  it('rejects an unknown sort or filter value', async () => {
    expect((await request(ctx.app).get('/api/catalog/courses?sort=cheapest')).status).toBe(400);
    expect((await request(ctx.app).get('/api/catalog/courses?level=expert')).status).toBe(400);
  });

  it('counts courses up the category tree', async () => {
    const res = await request(ctx.app).get('/api/catalog/categories?locale=en');
    const tree = res.body as CategoryNode[];
    const compliance = tree.find((node) => node.slug === 'compliance')!;

    expect(tree.map((node) => node.name)).toEqual([
      'Web Development',
      'Cybersecurity',
      'KVKK & Compliance',
    ]);
    expect(compliance.courseCount).toBe(4);
    expect(compliance.children.map((child) => child.courseCount)).toEqual([3, 1]);
  });
});

describe('search suggestions', () => {
  it('suggests matching course titles', async () => {
    const res = await request(ctx.app).get('/api/catalog/suggest?q=react&locale=en');

    expect(res.body.courses).toEqual([
      { slug: 'react-and-typescript', title: 'Building Interfaces with React and TypeScript' },
    ]);
  });

  it('only learns popular searches that found a course', async () => {
    for (let i = 0; i < 2; i++) {
      await list('q=kvkk');
      await list('q=zzqx');
    }

    const res = await request(ctx.app).get('/api/catalog/suggest?q=');
    expect(res.body.popular).toContain('kvkk');
    expect(res.body.popular).not.toContain('zzqx');
  });
});

describe('the course page', () => {
  it('shows the curriculum in order with free previews marked', async () => {
    const res = await request(ctx.app).get('/api/catalog/courses/kvkk-awareness?locale=tr');
    const course = res.body as CourseDetail;

    expect(res.status).toBe(200);
    expect(course.sections.map((section) => section.title)).toEqual([
      'Kavramlar',
      'İşleme ve aydınlatma',
      'Günlük işte KVKK',
    ]);
    expect(course.sections[0]?.lessons[0]).toMatchObject({
      title: 'Kişisel veri nedir?',
      isPreview: true,
    });
    const minutes = course.sections.reduce((sum, section) => sum + section.durationMinutes, 0);
    expect(minutes).toBe(course.durationMinutes);
    expect(course.description).toContain('hukuki danışmanlık yerine geçmez');
    expect(course.viewer).toBeNull();
  });

  it('introduces the instructor with their other courses and related ones', async () => {
    const res = await request(ctx.app).get('/api/catalog/courses/kvkk-awareness');
    const course = res.body as CourseDetail;

    expect(course.instructorProfile.name).toBe('Selin Demir');
    expect(course.instructorProfile.courseCount).toBe(4);
    expect(course.instructorProfile.otherCourses.map((c: CourseCard) => c.slug)).not.toContain(
      'kvkk-awareness',
    );
  });

  it('suggests related courses from the same field without repeating the instructor row', async () => {
    const res = await request(ctx.app).get('/api/catalog/courses/owasp-top-10-in-practice');
    const course = res.body as CourseDetail;

    // Same top-level category (Cybersecurity), another instructor.
    expect(course.related.map((c) => c.slug)).toEqual(['network-security-fundamentals']);
    const shown = course.instructorProfile.otherCourses.map((c) => c.slug);
    expect(course.related.some((c) => shown.includes(c.slug))).toBe(false);
  });
});

describe('enrolling and the wishlist', () => {
  it('enrolls a signed-in learner in a free course once', async () => {
    const { client, user } = await signedInUser(ctx);
    const before = await ctx.prisma.course.findUniqueOrThrow({ where: { slug: 'kvkk-awareness' } });

    expect((await client.post('/api/catalog/courses/kvkk-awareness/enroll')).status).toBe(201);
    expect((await client.post('/api/catalog/courses/kvkk-awareness/enroll')).status).toBe(200);

    const after = await ctx.prisma.course.findUniqueOrThrow({ where: { slug: 'kvkk-awareness' } });
    expect(after.enrollmentCount).toBe(before.enrollmentCount + 1);

    const page = await client.get('/api/catalog/courses/kvkk-awareness');
    expect(page.body.viewer).toEqual({ enrolled: true, wishlisted: false });

    const learning = await client.get('/api/me/learning');
    expect(learning.body.map((item: { course: CourseCard }) => item.course.slug)).toEqual([
      'kvkk-awareness',
    ]);
    expect(
      await ctx.prisma.auditLog.count({ where: { actorId: user.id, action: 'course.enrolled' } }),
    ).toBe(1);
  });

  it('does not enroll in a paid course before payments exist', async () => {
    const { client } = await signedInUser(ctx);

    const res = await client.post('/api/catalog/courses/owasp-top-10-in-practice/enroll');
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('payment_required');
  });

  it('asks visitors to sign in before enrolling', async () => {
    const visitor = await new Client(ctx.app).init();

    expect((await visitor.post('/api/catalog/courses/kvkk-awareness/enroll')).status).toBe(401);
  });

  it('saves and removes a course from the wishlist', async () => {
    const { client } = await signedInUser(ctx);
    const path = '/api/catalog/courses/owasp-top-10-in-practice/wishlist';

    expect((await client.agent.put(path).set('x-csrf-token', client.csrf)).status).toBe(204);
    expect((await client.agent.put(path).set('x-csrf-token', client.csrf)).status).toBe(204);
    expect((await client.get('/api/me/wishlist')).body).toHaveLength(1);

    expect((await client.delete(path)).status).toBe(204);
    expect((await client.get('/api/me/wishlist')).body).toHaveLength(0);
  });

  it("never shows one organization's enrollments to another", async () => {
    const a = await signedInUser(ctx);
    const b = await signedInUser(ctx);
    await a.client.post('/api/catalog/courses/kvkk-awareness/enroll');

    expect((await b.client.get('/api/me/learning')).body).toEqual([]);
    const page = await b.client.get('/api/catalog/courses/kvkk-awareness');
    expect(page.body.viewer).toEqual({ enrolled: false, wishlisted: false });
    expect(await scopedPrisma(ctx.prisma, b.user.orgId).enrollment.count()).toBe(0);
  });
});
