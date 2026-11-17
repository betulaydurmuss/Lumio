import { z } from 'zod';

/** At most this many members are assigned a course in one request. */
export const MAX_ASSIGNEES = 200;

export const assignCourseSchema = z.object({
  courseSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  userIds: z.uuid().array().min(1).max(MAX_ASSIGNEES),
  /** The last day to finish, YYYY-MM-DD, or none. */
  dueOn: z.iso.date().nullable().default(null),
});
export type AssignCourseInput = z.input<typeof assignCourseSchema>;

export const assignResultSchema = z.object({
  assigned: z.number().int(),
  alreadyAssigned: z.number().int(),
});
export type AssignResult = z.infer<typeof assignResultSchema>;

export const assignmentStatuses = ['not_started', 'in_progress', 'completed', 'overdue'] as const;
export const assignmentStatusSchema = z.enum(assignmentStatuses);
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

/**
 * Where an assignment stands. Finished is finished, even if late; otherwise a
 * passed due date outweighs any progress.
 */
export function assignmentStatus(
  percent: number,
  completed: boolean,
  dueOn: string | null,
  today: string,
): AssignmentStatus {
  if (completed) return 'completed';
  if (dueOn && dueOn < today) return 'overdue';
  return percent > 0 ? 'in_progress' : 'not_started';
}

export const assignmentSchema = z.object({
  id: z.string(),
  member: z.object({ id: z.string(), displayName: z.string(), email: z.string() }),
  course: z.object({ slug: z.string(), title: z.string() }),
  assignedAt: z.string(),
  dueOn: z.string().nullable(),
  status: assignmentStatusSchema,
  percent: z.number().int(),
  completedAt: z.string().nullable(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const transcriptEntrySchema = z.object({
  course: z.object({ slug: z.string(), title: z.string() }),
  minutes: z.number().int(),
  enrolledAt: z.string(),
  completedAt: z.string().nullable(),
  percent: z.number().int(),
  certificateNo: z.string().nullable(),
  assigned: z.boolean(),
  dueOn: z.string().nullable(),
});
export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;

/** A learner's record of study: every course, how far it went, and the proof. */
export const transcriptSchema = z.object({
  learner: z.object({ displayName: z.string(), email: z.string(), organization: z.string() }),
  generatedAt: z.string(),
  totals: z.object({
    courses: z.number().int(),
    completed: z.number().int(),
    /** Course length of the finished courses, in minutes. */
    completedMinutes: z.number().int(),
    certificates: z.number().int(),
  }),
  entries: transcriptEntrySchema.array(),
});
export type Transcript = z.infer<typeof transcriptSchema>;
