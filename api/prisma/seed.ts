import { lessonBodySchema, normalizeSearch } from '@lumio/shared';
import { createPrisma, type PrismaClient } from '../src/db.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { categories, courses, instructors, type CategorySeed } from './seed/catalog-data.js';
import { lessonContent } from './seed/lesson-content.js';
import { quizContent, type QuizSeed } from './seed/quiz-content.js';

// Every video lesson plays the same short demo clip until real lessons are recorded.
const DEMO_VIDEO = {
  videoKey: 'demo/lesson.mp4',
  captionsTrKey: 'demo/captions.tr.vtt',
  captionsEnKey: 'demo/captions.en.vtt',
  videoSeconds: 30,
};
const NO_VIDEO = { videoKey: null, captionsTrKey: null, captionsEnKey: null, videoSeconds: null };

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

    const { status: _status, publishedAt: _publishedAt, ...content } = data;
    // Real enrollments are counted on top of the demo figure, so an update leaves the count alone.
    const course = await prisma.course.upsert({
      where: { slug: seed.slug },
      create: { slug: seed.slug, ...data, enrollmentCount: seed.enrollments },
      // Whether a course is on the catalog is the platform operator's call once
      // it exists, so running the seed again (every deploy does) leaves it alone.
      update: content,
    });

    // Sections and lessons are matched by position, so learner progress keeps
    // pointing at the same lesson rows when the seed runs again.
    for (const [sectionIndex, section] of seed.sections.entries()) {
      const sectionRow = await prisma.section.upsert({
        where: { courseId_position: { courseId: course.id, position: sectionIndex } },
        create: {
          courseId: course.id,
          position: sectionIndex,
          titleTr: section.tr,
          titleEn: section.en,
        },
        update: { titleTr: section.tr, titleEn: section.en },
      });

      for (const [lessonIndex, [type, tr, en, minutes, preview]] of section.lessons.entries()) {
        const written = lessonContent[seed.slug]?.[en];
        const lesson = {
          type,
          titleTr: tr,
          titleEn: en,
          durationMinutes: minutes,
          isPreview: preview ?? false,
          // Validated here so a typo in the content fails the seed, not the player.
          bodyTr: written ? lessonBodySchema.parse(written.tr) : Prisma.DbNull,
          bodyEn: written ? lessonBodySchema.parse(written.en) : Prisma.DbNull,
          ...(type === 'video' ? DEMO_VIDEO : NO_VIDEO),
        };
        await prisma.lesson.upsert({
          where: { sectionId_position: { sectionId: sectionRow.id, position: lessonIndex } },
          create: { sectionId: sectionRow.id, position: lessonIndex, ...lesson },
          update: lesson,
        });
      }
    }

    for (const quiz of quizContent[seed.slug] ?? []) await upsertQuiz(prisma, course.id, quiz);
  }

  return { categories: categoryIds.size, instructors: instructorIds.size, courses: courses.length };
}

async function upsertQuiz(prisma: PrismaClient, courseId: string, seed: QuizSeed) {
  for (const question of seed.questions) {
    const count = question.tr.options.length;
    if (question.en.options.length !== count || question.answer >= count) {
      throw new Error(`Quiz "${seed.title[1]}" has a question with mismatched options`);
    }
  }

  const sectionId =
    seed.section === 'final'
      ? null
      : (
          await prisma.section.findUniqueOrThrow({
            where: { courseId_position: { courseId, position: seed.section } },
          })
        ).id;
  const data = {
    titleTr: seed.title[0],
    titleEn: seed.title[1],
    passPercent: seed.passPercent ?? 70,
  };
  const existing = await prisma.quiz.findFirst({ where: { courseId, sectionId } });
  const quiz = existing
    ? await prisma.quiz.update({ where: { id: existing.id }, data })
    : await prisma.quiz.create({ data: { courseId, sectionId, ...data } });

  for (const [position, question] of seed.questions.entries()) {
    const fields = {
      promptTr: question.tr.prompt,
      promptEn: question.en.prompt,
      optionsTr: question.tr.options,
      optionsEn: question.en.options,
      correctIndex: question.answer,
      explanationTr: question.tr.explanation,
      explanationEn: question.en.explanation,
    };
    await prisma.quizQuestion.upsert({
      where: { quizId_position: { quizId: quiz.id, position } },
      create: { quizId: quiz.id, position, ...fields },
      update: fields,
    });
  }
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
