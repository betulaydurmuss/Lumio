import { normalizeSearch } from '@lumio/shared';
import type { PrismaClient } from '../db.js';

/**
 * Rebuilds the folded text a course is searched by: both titles and subtitles,
 * the instructor, and the names of its category and that category's parent.
 * Called whenever any of those change, so search never runs on stale words.
 */
export async function refreshSearchText(prisma: PrismaClient, courseIds: string[]) {
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    include: { instructor: true, category: { include: { parent: true } } },
  });
  for (const course of courses) {
    const { category } = course;
    const searchText = normalizeSearch(
      [
        course.titleTr,
        course.titleEn,
        course.subtitleTr,
        course.subtitleEn,
        course.instructor.name,
        category.nameTr,
        category.nameEn,
        category.parent?.nameTr ?? '',
        category.parent?.nameEn ?? '',
      ].join(' '),
    );
    if (searchText !== course.searchText) {
      await prisma.course.update({ where: { id: course.id }, data: { searchText } });
    }
  }
}
