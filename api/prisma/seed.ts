import { normalizeSearch } from '@lumio/shared';
import { createPrisma, type PrismaClient } from '../src/db.js';
import { categories, courses, instructors, type CategorySeed } from './seed/catalog-data.js';

/**
 * Loads the demo catalog. Safe to run repeatedly: rows are matched by slug and
 * updated in place, so a second run changes nothing.
 */
export async function seedCatalog(prisma: PrismaClient) {
  const categoryIds = new Map<string, string>();
  const categoryNames = new Map<string, string>();

  async function upsertCategory(seed: CategorySeed, parentId: string | null, position: number) {
    const row = await prisma.category.upsert({
      where: { slug: seed.slug },
      create: { slug: seed.slug, nameTr: seed.tr, nameEn: seed.en, parentId, position },
      update: { nameTr: seed.tr, nameEn: seed.en, parentId, position },
    });
    categoryIds.set(seed.slug, row.id);
    categoryNames.set(seed.slug, `${seed.tr} ${seed.en}`);
    for (const [index, child] of (seed.children ?? []).entries()) {
      await upsertCategory(child, row.id, index);
      categoryNames.set(child.slug, `${categoryNames.get(child.slug)} ${seed.tr} ${seed.en}`);
    }
  }
  for (const [index, category] of categories.entries()) await upsertCategory(category, null, index);

  const instructorIds = new Map<string, { id: string; name: string }>();
  for (const seed of instructors) {
    const data = {
      name: seed.name,
      headlineTr: seed.headline[0],
      headlineEn: seed.headline[1],
      bioTr: seed.bio[0],
      bioEn: seed.bio[1],
    };
    const row = await prisma.instructor.upsert({
      where: { slug: seed.slug },
      create: { slug: seed.slug, ...data },
      update: data,
    });
    instructorIds.set(seed.slug, { id: row.id, name: row.name });
  }

  for (const seed of courses) {
    const categoryId = categoryIds.get(seed.category);
    const instructor = instructorIds.get(seed.instructor);
    if (!categoryId || !instructor)
      throw new Error(`Unknown category or instructor in ${seed.slug}`);

    const lessons = seed.sections.flatMap((section) => section.lessons);
    const data = {
      categoryId,
      instructorId: instructor.id,
      status: 'published' as const,
      titleTr: seed.title[0],
      titleEn: seed.title[1],
      subtitleTr: seed.subtitle[0],
      subtitleEn: seed.subtitle[1],
      descriptionTr: seed.description[0],
      descriptionEn: seed.description[1],
      outcomesTr: seed.outcomes[0],
      outcomesEn: seed.outcomes[1],
      requirementsTr: seed.requirements[0],
      requirementsEn: seed.requirements[1],
      audienceTr: seed.audience[0],
      audienceEn: seed.audience[1],
      level: seed.level,
      language: seed.language,
      priceAmount: seed.price,
      listPriceAmount: seed.listPrice ?? null,
      hasCertificate: seed.certificate ?? true,
      coverStyle: seed.cover,
      searchText: normalizeSearch(
        [
          seed.title[0],
          seed.title[1],
          seed.subtitle[0],
          seed.subtitle[1],
          instructor.name,
          categoryNames.get(seed.category) ?? '',
        ].join(' '),
      ),
      durationMinutes: lessons.reduce((sum, lesson) => sum + lesson[3], 0),
      lessonCount: lessons.length,
      ratingAverage: seed.rating[0],
      ratingCount: seed.rating[1],
      completionCount: seed.completions,
      publishedAt: new Date(Date.now() - seed.publishedDaysAgo * 86_400_000),
    };

    const existing = await prisma.course.findUnique({ where: { slug: seed.slug } });
    if (existing) {
      // Keep real enrollments counted on top of the demo figure.
      await prisma.course.update({ where: { id: existing.id }, data });
      continue;
    }
    await prisma.course.create({
      data: {
        slug: seed.slug,
        ...data,
        enrollmentCount: seed.enrollments,
        sections: {
          create: seed.sections.map((section, sectionIndex) => ({
            position: sectionIndex,
            titleTr: section.tr,
            titleEn: section.en,
            lessons: {
              create: section.lessons.map(([type, tr, en, minutes, preview], lessonIndex) => ({
                position: lessonIndex,
                type,
                titleTr: tr,
                titleEn: en,
                durationMinutes: minutes,
                isPreview: preview ?? false,
              })),
            },
          })),
        },
      },
    });
  }

  return { categories: categoryIds.size, instructors: instructorIds.size, courses: courses.length };
}

const isEntryPoint = process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed.ts');
if (isEntryPoint) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(url);
  seedCatalog(prisma)
    .then((result) => console.log('seeded', result))
    .finally(() => void prisma.$disconnect());
}
