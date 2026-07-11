import { eq, inArray } from "drizzle-orm";
import { db, lessonProgressTable, lessonBookmarksTable, type Lesson } from "@workspace/db";

/** Attaches the given student's completed/bookmarked state to a list of lessons. */
export async function attachLessonState(lessons: Lesson[], studentId: number) {
  if (lessons.length === 0) return [];
  const ids = lessons.map((l) => l.id);
  const [progress, bookmarks] = await Promise.all([
    db.select().from(lessonProgressTable).where(inArray(lessonProgressTable.lessonId, ids)),
    db.select().from(lessonBookmarksTable).where(inArray(lessonBookmarksTable.lessonId, ids)),
  ]);
  const progressByLesson = new Map(
    progress.filter((p) => p.studentId === studentId).map((p) => [p.lessonId, p]),
  );
  const bookmarkedLessons = new Set(
    bookmarks.filter((b) => b.studentId === studentId).map((b) => b.lessonId),
  );
  return lessons.map((lesson) => ({
    ...lesson,
    completed: progressByLesson.get(lesson.id)?.completed ?? false,
    bookmarked: bookmarkedLessons.has(lesson.id),
  }));
}

export async function attachSingleLessonState(lesson: Lesson, studentId: number) {
  const [row] = await attachLessonState([lesson], studentId);
  return row;
}

// Re-export for convenience within route modules that only need eq.
export { eq };
