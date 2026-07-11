import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, assignmentsTable, submissionsTable, usersTable } from "@workspace/db";
import {
  ListAssignmentsQueryParams,
  CreateAssignmentBody,
  UpdateAssignmentBody,
  SubmitAssignmentBody,
  GradeSubmissionBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

async function withMySubmissionStatus(
  assignment: typeof assignmentsTable.$inferSelect,
  studentId: number,
) {
  const [latest] = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.assignmentId, assignment.id), eq(submissionsTable.studentId, studentId)))
    .orderBy(desc(submissionsTable.submittedAt))
    .limit(1);
  return { ...assignment, mySubmissionStatus: latest?.status ?? null };
}

router.get("/assignments", requireAuth, async (req, res): Promise<void> => {
  const query = ListAssignmentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const assignments = await db
    .select()
    .from(assignmentsTable)
    .where(query.data.courseId ? eq(assignmentsTable.courseId, query.data.courseId) : undefined)
    .orderBy(assignmentsTable.dueDate);
  res.json(await Promise.all(assignments.map((a) => withMySubmissionStatus(a, req.user!.id))));
});

router.post(
  "/assignments",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const parsed = CreateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [assignment] = await db.insert(assignmentsTable).values(parsed.data).returning();
    res.status(201).json({ ...assignment, mySubmissionStatus: null });
  },
);

router.get("/assignments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id));
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  res.json(await withMySubmissionStatus(assignment, req.user!.id));
});

router.patch(
  "/assignments/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [assignment] = await db
      .update(assignmentsTable)
      .set(parsed.data)
      .where(eq(assignmentsTable.id, id))
      .returning();
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.json(await withMySubmissionStatus(assignment, req.user!.id));
  },
);

router.delete(
  "/assignments/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(assignmentsTable).where(eq(assignmentsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get(
  "/assignments/:id/submissions",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const rows = await db
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
      .where(eq(submissionsTable.assignmentId, id))
      .orderBy(desc(submissionsTable.submittedAt));
    res.json(rows);
  },
);

router.post("/assignments/:id/submissions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SubmitAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id));
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  const isLate = assignment.dueDate ? new Date() > assignment.dueDate : false;
  const [submission] = await db
    .insert(submissionsTable)
    .values({
      assignmentId: id,
      studentId: req.user!.id,
      fileUrl: parsed.data.fileUrl,
      comment: parsed.data.comment,
      status: isLate ? "late" : "submitted",
    })
    .returning();
  res.status(201).json({ ...submission, studentName: req.user!.name });
});

router.get("/assignments/:id/submissions/me", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.assignmentId, id), eq(submissionsTable.studentId, req.user!.id)))
    .orderBy(desc(submissionsTable.submittedAt));
  res.json(rows.map((r) => ({ ...r, studentName: req.user!.name })));
});

router.patch(
  "/submissions/:id/grade",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = GradeSubmissionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [submission] = await db
      .update(submissionsTable)
      .set({ score: parsed.data.score, feedback: parsed.data.feedback, status: "graded", gradedAt: new Date() })
      .where(eq(submissionsTable.id, id))
      .returning();
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, submission.studentId));
    res.json({ ...submission, studentName: student?.name ?? "" });
  },
);

export default router;
