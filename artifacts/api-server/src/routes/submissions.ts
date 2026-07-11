/**
 * Submission management routes:
 *
 * GET   /submissions           - all submissions (admin/mentor)
 * GET   /submissions/:id       - get submission + test results
 * PATCH /submissions/:id/grade - mentor/admin grade override
 */
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  challengeSubmissionsTable,
  submissionTestResultsTable,
  challengeTestCasesTable,
  codingChallengesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// ─── List all submissions (staff) ────────────────────────────────────────────

router.get(
  "/submissions",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const { challengeId, studentId } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (challengeId) conditions.push(eq(challengeSubmissionsTable.challengeId, parseInt(challengeId)));
    if (studentId) conditions.push(eq(challengeSubmissionsTable.studentId, parseInt(studentId)));

    const rows = await db
      .select({
        submission: challengeSubmissionsTable,
        studentName: usersTable.name,
        studentEmail: usersTable.email,
        challengeTitle: codingChallengesTable.title,
      })
      .from(challengeSubmissionsTable)
      .leftJoin(usersTable, eq(challengeSubmissionsTable.studentId, usersTable.id))
      .leftJoin(codingChallengesTable, eq(challengeSubmissionsTable.challengeId, codingChallengesTable.id))
      .where(conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : conditions.reduce((a, b) => and(a, b)))
      .orderBy(desc(challengeSubmissionsTable.submittedAt))
      .limit(200);

    res.json(
      rows.map((r) => ({
        ...r.submission,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        challengeTitle: r.challengeTitle,
      })),
    );
  },
);

// ─── Get submission detail ────────────────────────────────────────────────────

router.get("/submissions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;
  const isStaff = req.user!.role === "admin" || req.user!.role === "mentor";

  const [submission] = await db
    .select()
    .from(challengeSubmissionsTable)
    .where(eq(challengeSubmissionsTable.id, id));

  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }
  if (!isStaff && submission.studentId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  // Get test results with test case info
  const testResults = await db
    .select({
      result: submissionTestResultsTable,
      testCase: challengeTestCasesTable,
    })
    .from(submissionTestResultsTable)
    .leftJoin(challengeTestCasesTable, eq(submissionTestResultsTable.testCaseId, challengeTestCasesTable.id))
    .where(eq(submissionTestResultsTable.submissionId, id));

  const [student] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, submission.studentId));

  res.json({
    ...submission,
    studentName: student?.name,
    studentEmail: student?.email,
    testResults: testResults.map((r) => ({
      id: r.result.id,
      testCaseId: r.result.testCaseId,
      passed: r.result.passed,
      actualOutput: r.result.actualOutput,
      executionTimeMs: r.result.executionTimeMs,
      errorMessage: r.result.errorMessage,
      description: r.testCase?.description,
      isHidden: r.testCase?.isHidden,
      // Only reveal expected output to staff or for non-hidden tests
      input: r.testCase?.isHidden && !isStaff ? undefined : r.testCase?.input,
      expectedOutput: r.testCase?.isHidden && !isStaff ? undefined : r.testCase?.expectedOutput,
    })),
  });
});

// ─── Grade override ───────────────────────────────────────────────────────────

router.patch(
  "/submissions/:id/grade",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    const { overrideScore, overrideFeedback } = req.body as {
      overrideScore?: number;
      overrideFeedback?: string;
    };

    if (overrideScore === undefined) {
      res.status(400).json({ error: "overrideScore is required" }); return;
    }
    if (overrideScore < 0 || overrideScore > 10000) {
      res.status(400).json({ error: "overrideScore must be 0-10000" }); return;
    }

    const [updated] = await db
      .update(challengeSubmissionsTable)
      .set({
        overriddenBy: req.user!.id,
        overrideScore,
        overrideFeedback: overrideFeedback ?? null,
      })
      .where(eq(challengeSubmissionsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Submission not found" }); return; }
    res.json(updated);
  },
);

export default router;
