import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  cohortsTable,
  cohortEnrollmentsTable,
  mentorCohortsTable,
  cohortCoursesTable,
  usersTable,
  coursesTable,
} from "@workspace/db";
import {
  ListCohortsQueryParams,
  CreateCohortBody,
  UpdateCohortBody,
  EnrollStudentBody,
  UpdateEnrollmentBody,
  AssignMentorBody,
  AddCohortCourseBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeCohort } from "../lib/serializers";

const router: IRouter = Router();

function toDateString(value: Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.toISOString().slice(0, 10);
}

router.get("/cohorts", requireAuth, async (req, res): Promise<void> => {
  const query = ListCohortsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const cohorts = await db
    .select()
    .from(cohortsTable)
    .where(query.data.status ? eq(cohortsTable.status, query.data.status) : undefined)
    .orderBy(cohortsTable.startDate);
  res.json(await Promise.all(cohorts.map(serializeCohort)));
});

router.post(
  "/cohorts",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateCohortBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [cohort] = await db
      .insert(cohortsTable)
      .values({
        ...parsed.data,
        startDate: toDateString(parsed.data.startDate)!,
        endDate: toDateString(parsed.data.endDate),
      })
      .returning();
    res.status(201).json(await serializeCohort(cohort));
  },
);

router.get("/cohorts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [cohort] = await db.select().from(cohortsTable).where(eq(cohortsTable.id, id));
  if (!cohort) {
    res.status(404).json({ error: "Cohort not found" });
    return;
  }
  res.json(await serializeCohort(cohort));
});

router.patch(
  "/cohorts/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateCohortBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { startDate, endDate, ...rest } = parsed.data;
    const [cohort] = await db
      .update(cohortsTable)
      .set({
        ...rest,
        ...(startDate !== undefined ? { startDate: toDateString(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: toDateString(endDate) } : {}),
      })
      .where(eq(cohortsTable.id, id))
      .returning();
    if (!cohort) {
      res.status(404).json({ error: "Cohort not found" });
      return;
    }
    res.json(await serializeCohort(cohort));
  },
);

router.delete(
  "/cohorts/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(cohortsTable).where(eq(cohortsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Cohort not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/cohorts/:id/students", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select({
      id: cohortEnrollmentsTable.id,
      cohortId: cohortEnrollmentsTable.cohortId,
      studentId: cohortEnrollmentsTable.studentId,
      status: cohortEnrollmentsTable.status,
      enrolledAt: cohortEnrollmentsTable.enrolledAt,
      studentName: usersTable.name,
      studentEmail: usersTable.email,
    })
    .from(cohortEnrollmentsTable)
    .innerJoin(usersTable, eq(usersTable.id, cohortEnrollmentsTable.studentId))
    .where(eq(cohortEnrollmentsTable.cohortId, id));
  res.json(rows);
});

router.post(
  "/cohorts/:id/students",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = EnrollStudentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [enrollment] = await db
      .insert(cohortEnrollmentsTable)
      .values({ cohortId: id, studentId: parsed.data.studentId })
      .returning();
    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parsed.data.studentId));
    res.status(201).json({
      ...enrollment,
      studentName: student?.name ?? "",
      studentEmail: student?.email ?? "",
    });
  },
);

router.patch(
  "/cohorts/:id/students/:enrollmentId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const enrollmentId = parseInt(String(req.params.enrollmentId), 10);
    if (Number.isNaN(enrollmentId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateEnrollmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [updated] = await db
      .update(cohortEnrollmentsTable)
      .set({ status: parsed.data.status })
      .where(eq(cohortEnrollmentsTable.id, enrollmentId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Enrollment not found" });
      return;
    }
    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, updated.studentId));
    res.json({ ...updated, studentName: student?.name ?? "", studentEmail: student?.email ?? "" });
  },
);

router.delete(
  "/cohorts/:id/students/:enrollmentId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const enrollmentId = parseInt(String(req.params.enrollmentId), 10);
    if (Number.isNaN(enrollmentId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db
      .delete(cohortEnrollmentsTable)
      .where(eq(cohortEnrollmentsTable.id, enrollmentId))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Enrollment not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/cohorts/:id/mentors", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select({
      id: mentorCohortsTable.id,
      cohortId: mentorCohortsTable.cohortId,
      mentorId: mentorCohortsTable.mentorId,
      assignedAt: mentorCohortsTable.assignedAt,
      mentorName: usersTable.name,
      mentorEmail: usersTable.email,
    })
    .from(mentorCohortsTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorCohortsTable.mentorId))
    .where(eq(mentorCohortsTable.cohortId, id));
  res.json(rows);
});

router.post(
  "/cohorts/:id/mentors",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = AssignMentorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [assignment] = await db
      .insert(mentorCohortsTable)
      .values({ cohortId: id, mentorId: parsed.data.mentorId })
      .returning();
    const [mentor] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.mentorId));
    res.status(201).json({ ...assignment, mentorName: mentor?.name ?? "", mentorEmail: mentor?.email ?? "" });
  },
);

router.delete(
  "/cohorts/:id/mentors/:mentorCohortId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const mentorCohortId = parseInt(String(req.params.mentorCohortId), 10);
    if (Number.isNaN(mentorCohortId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db
      .delete(mentorCohortsTable)
      .where(eq(mentorCohortsTable.id, mentorCohortId))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Mentor assignment not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/cohorts/:id/courses", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select({
      id: cohortCoursesTable.id,
      cohortId: cohortCoursesTable.cohortId,
      courseId: cohortCoursesTable.courseId,
      order: cohortCoursesTable.order,
      addedAt: cohortCoursesTable.addedAt,
      courseTitle: coursesTable.title,
    })
    .from(cohortCoursesTable)
    .innerJoin(coursesTable, eq(coursesTable.id, cohortCoursesTable.courseId))
    .where(eq(cohortCoursesTable.cohortId, id))
    .orderBy(cohortCoursesTable.order);
  res.json(rows);
});

router.post(
  "/cohorts/:id/courses",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = AddCohortCourseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [cohortCourse] = await db
      .insert(cohortCoursesTable)
      .values({ cohortId: id, courseId: parsed.data.courseId, order: parsed.data.order ?? 0 })
      .returning();
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parsed.data.courseId));
    res.status(201).json({ ...cohortCourse, courseTitle: course?.title ?? "" });
  },
);

router.delete(
  "/cohorts/:id/courses/:cohortCourseId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const cohortCourseId = parseInt(String(req.params.cohortCourseId), 10);
    if (Number.isNaN(cohortCourseId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db
      .delete(cohortCoursesTable)
      .where(eq(cohortCoursesTable.id, cohortCourseId))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Cohort course not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
