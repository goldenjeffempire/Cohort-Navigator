import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  cohortsTable,
  cohortEnrollmentsTable,
  mentorCohortsTable,
  cohortCoursesTable,
  coursesTable,
  assignmentsTable,
  submissionsTable,
  announcementsTable,
  notificationsTable,
  usersTable,
  lessonsTable,
  modulesTable,
  lessonProgressTable,
  scholarshipApplicationsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeCohort } from "../lib/serializers";

const router: IRouter = Router();

router.get(
  "/dashboard/student",
  requireAuth,
  requireRole("student"),
  async (req, res): Promise<void> => {
    const studentId = req.user!.id;
    const [enrollment] = await db
      .select()
      .from(cohortEnrollmentsTable)
      .where(and(eq(cohortEnrollmentsTable.studentId, studentId), eq(cohortEnrollmentsTable.status, "active")))
      .orderBy(desc(cohortEnrollmentsTable.enrolledAt))
      .limit(1);

    let currentCohort = null;
    let enrolledCourses: (typeof coursesTable.$inferSelect)[] = [];
    if (enrollment) {
      const [cohort] = await db.select().from(cohortsTable).where(eq(cohortsTable.id, enrollment.cohortId));
      if (cohort) currentCohort = await serializeCohort(cohort);
      const cohortCourses = await db
        .select()
        .from(cohortCoursesTable)
        .where(eq(cohortCoursesTable.cohortId, enrollment.cohortId));
      if (cohortCourses.length) {
        enrolledCourses = await db
          .select()
          .from(coursesTable)
          .where(inArray(coursesTable.id, cohortCourses.map((c) => c.courseId)));
      }
    }

    let progressPercent = 0;
    if (enrolledCourses.length) {
      const modules = await db
        .select()
        .from(modulesTable)
        .where(inArray(modulesTable.courseId, enrolledCourses.map((c) => c.id)));
      const lessons = modules.length
        ? await db.select().from(lessonsTable).where(inArray(lessonsTable.moduleId, modules.map((m) => m.id)))
        : [];
      if (lessons.length) {
        const progress = await db
          .select()
          .from(lessonProgressTable)
          .where(
            and(
              eq(lessonProgressTable.studentId, studentId),
              inArray(lessonProgressTable.lessonId, lessons.map((l) => l.id)),
            ),
          );
        const completedCount = progress.filter((p) => p.completed).length;
        progressPercent = Math.round((completedCount / lessons.length) * 100);
      }
    }

    const upcomingAssignments = enrolledCourses.length
      ? await db
          .select()
          .from(assignmentsTable)
          .where(inArray(assignmentsTable.courseId, enrolledCourses.map((c) => c.id)))
          .orderBy(assignmentsTable.dueDate)
          .limit(5)
      : [];

    const recentAnnouncements = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.createdAt))
      .limit(5);

    const [{ unreadCount }] = await db
      .select({ unreadCount: count() })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, studentId), eq(notificationsTable.isRead, false)));

    res.json({
      currentCohort,
      enrolledCourses: await Promise.all(enrolledCourses.map(async (c) => ({ ...c, moduleCount: (await db.select().from(modulesTable).where(eq(modulesTable.courseId, c.id))).length }))),
      progressPercent,
      upcomingAssignments: upcomingAssignments.map((a) => ({ ...a, mySubmissionStatus: null })),
      recentAnnouncements: await Promise.all(
        recentAnnouncements.map(async (a) => {
          const [author] = await db.select().from(usersTable).where(eq(usersTable.id, a.authorId));
          return { ...a, authorName: author?.name ?? "" };
        }),
      ),
      unreadNotificationCount: unreadCount,
    });
  },
);

router.get(
  "/dashboard/mentor",
  requireAuth,
  requireRole("mentor"),
  async (req, res): Promise<void> => {
    const mentorId = req.user!.id;
    const assignments = await db
      .select()
      .from(mentorCohortsTable)
      .where(eq(mentorCohortsTable.mentorId, mentorId));
    const cohortIds = assignments.map((a) => a.cohortId);
    const cohorts = cohortIds.length
      ? await db.select().from(cohortsTable).where(inArray(cohortsTable.id, cohortIds))
      : [];

    let studentCount = 0;
    if (cohortIds.length) {
      const [{ studentCount: sc }] = await db
        .select({ studentCount: count() })
        .from(cohortEnrollmentsTable)
        .where(inArray(cohortEnrollmentsTable.cohortId, cohortIds));
      studentCount = sc;
    }

    const [{ pendingCount }] = await db
      .select({ pendingCount: count() })
      .from(submissionsTable)
      .where(eq(submissionsTable.status, "submitted"));

    const recentSubmissions = await db
      .select({
        id: submissionsTable.id,
        assignmentId: submissionsTable.assignmentId,
        studentId: submissionsTable.studentId,
        studentName: usersTable.name,
        fileUrl: submissionsTable.fileUrl,
        comment: submissionsTable.comment,
        status: submissionsTable.status,
        score: submissionsTable.score,
        feedback: submissionsTable.feedback,
        submittedAt: submissionsTable.submittedAt,
        gradedAt: submissionsTable.gradedAt,
      })
      .from(submissionsTable)
      .innerJoin(usersTable, eq(usersTable.id, submissionsTable.studentId))
      .orderBy(desc(submissionsTable.submittedAt))
      .limit(5);

    res.json({
      assignedCohorts: await Promise.all(cohorts.map(serializeCohort)),
      studentCount,
      pendingSubmissionCount: pendingCount,
      recentSubmissions,
    });
  },
);

router.get(
  "/dashboard/admin",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [[{ totalStudents }], [{ totalMentors }], [{ totalCohorts }], [{ activeCohorts }], [{ totalCourses }], [{ pendingScholarshipCount }]] =
      await Promise.all([
        db.select({ totalStudents: count() }).from(usersTable).where(eq(usersTable.role, "student")),
        db.select({ totalMentors: count() }).from(usersTable).where(eq(usersTable.role, "mentor")),
        db.select({ totalCohorts: count() }).from(cohortsTable),
        db.select({ activeCohorts: count() }).from(cohortsTable).where(eq(cohortsTable.status, "active")),
        db.select({ totalCourses: count() }).from(coursesTable),
        db
          .select({ pendingScholarshipCount: count() })
          .from(scholarshipApplicationsTable)
          .where(eq(scholarshipApplicationsTable.status, "pending")),
      ]);

    const recentAnnouncements = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.createdAt))
      .limit(5);

    res.json({
      totalStudents,
      totalMentors,
      totalCohorts,
      activeCohorts,
      totalCourses,
      pendingScholarshipCount,
      recentAnnouncements: await Promise.all(
        recentAnnouncements.map(async (a) => {
          const [author] = await db.select().from(usersTable).where(eq(usersTable.id, a.authorId));
          return { ...a, authorName: author?.name ?? "" };
        }),
      ),
    });
  },
);

export default router;
