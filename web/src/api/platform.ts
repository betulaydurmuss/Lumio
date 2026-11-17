import {
  platformCategorySchema,
  platformCourseDetailSchema,
  type CategoryCreateInput,
  type CategoryRenameInput,
  type CourseEditInput,
} from '@lumio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';

export function usePlatformCourse(slug: string) {
  return useQuery({
    queryKey: ['platform', 'course', slug],
    queryFn: () =>
      api('GET', `/api/platform/courses/${encodeURIComponent(slug)}`, {
        schema: platformCourseDetailSchema,
      }),
    retry: false,
  });
}

export function usePlatformCategories() {
  return useQuery({
    queryKey: ['platform', 'categories'],
    queryFn: () =>
      api('GET', '/api/platform/categories', { schema: platformCategorySchema.array() }),
    retry: false,
  });
}

/** Catalog edits change what every visitor sees, so the public catalog is refreshed too. */
function useCatalogMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]),
  });
}

export const useSaveCourse = (slug: string) =>
  useCatalogMutation((input: CourseEditInput) =>
    api<void>('PUT', `/api/platform/courses/${encodeURIComponent(slug)}`, { body: input }),
  );

export const useCreateCategory = () =>
  useCatalogMutation((input: CategoryCreateInput) =>
    api('POST', '/api/platform/categories', { body: input }),
  );

export const useRenameCategory = () =>
  useCatalogMutation(({ slug, ...input }: CategoryRenameInput & { slug: string }) =>
    api<void>('PATCH', `/api/platform/categories/${encodeURIComponent(slug)}`, { body: input }),
  );

export const useDeleteCategory = () =>
  useCatalogMutation((slug: string) =>
    api<void>('DELETE', `/api/platform/categories/${encodeURIComponent(slug)}`),
  );
