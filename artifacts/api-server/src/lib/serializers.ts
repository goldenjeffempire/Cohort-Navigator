import { count, eq } from "drizzle-orm";
import { db, cohortEnrollmentsTable, modulesTable, quizQuestionsTable } from "@workspace/db";
import type { Cohort, Course, Quiz } from "@workspace/db";

export async function serializeCohort(cohort: Cohort) {
  const [row] = await db
    .select({ studentCount: count() })
    .from(cohortEnrollmentsTable)
    .where(eq(cohortEnrollmentsTable.cohortId, cohort.id));
  return { ...cohort, studentCount: row?.studentCount ?? 0 };
}

export async function serializeCourse(course: Course) {
  const [row] = await db
    .select({ moduleCount: count() })
    .from(modulesTable)
    .where(eq(modulesTable.courseId, course.id));
  return { ...course, moduleCount: row?.moduleCount ?? 0 };
}

export async function serializeQuiz(quiz: Quiz) {
  const [row] = await db
    .select({ questionCount: count() })
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.quizId, quiz.id));
  return { ...quiz, questionCount: row?.questionCount ?? 0 };
}
