/**
 * Coding challenge routes:
 *
 * GET    /challenges                - list published challenges
 * POST   /challenges                - create (admin/mentor)
 * GET    /challenges/:id            - get challenge + public test cases
 * PATCH  /challenges/:id            - update (admin/mentor)
 * DELETE /challenges/:id            - delete (admin)
 * GET    /challenges/:id/test-cases - all for staff, public-only for students
 * POST   /challenges/:id/test-cases - add test case (admin/mentor)
 * DELETE /test-cases/:id            - delete test case (admin/mentor)
 * POST   /challenges/:id/submit     - submit solution + auto-grade
 * GET    /challenges/:id/submissions - my submissions (student) / all (staff)
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import {
  db,
  codingChallengesTable,
  challengeTestCasesTable,
  challengeSubmissionsTable,
  submissionTestResultsTable,
  codingStreaksTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { runTestCase, type SupportedLanguage } from "../lib/executor";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeChallenge(c: any, extra?: object) {
  const { solutionCode: _sc, ...rest } = c;
  return { ...rest, ...extra };
}

async function updateStreak(userId: number, solved: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(codingStreaksTable)
    .where(eq(codingStreaksTable.userId, userId));

  if (!existing) {
    await db.insert(codingStreaksTable).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
      totalChallengesSolved: solved ? 1 : 0,
      totalSubmissions: 1,
    });
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak = existing.currentStreak;
  if (existing.lastActivityDate === today) {
    newStreak = existing.currentStreak; // already counted today
  } else if (existing.lastActivityDate === yesterdayStr) {
    newStreak = existing.currentStreak + 1;
  } else {
    newStreak = 1; // streak broken
  }

  const wasSolvedBefore =
    solved &&
    existing.totalChallengesSolved >=
      (await db
        .select({ c: count() })
        .from(challengeSubmissionsTable)
        .where(
          and(
            eq(challengeSubmissionsTable.studentId, userId),
            eq(challengeSubmissionsTable.status, "passed"),
          ),
        )
        .then(([r]) => r?.c ?? 0));

  await db
    .update(codingStreaksTable)
    .set({
      currentStreak: newStreak,
      longestStreak: Math.max(existing.longestStreak, newStreak),
      lastActivityDate: today,
      totalChallengesSolved: solved
        ? existing.totalChallengesSolved + 1
        : existing.totalChallengesSolved,
      totalSubmissions: existing.totalSubmissions + 1,
      updatedAt: new Date(),
    })
    .where(eq(codingStreaksTable.userId, userId));
}

// ─── List challenges ──────────────────────────────────────────────────────────

router.get("/challenges", requireAuth, async (req, res): Promise<void> => {
  const { courseId, difficulty, language, type, all } = req.query as Record<string, string>;
  const isStaff = req.user!.role === "admin" || req.user!.role === "mentor";

  let query = db.select().from(codingChallengesTable);
  const conditions: any[] = [];

  // Students only see published challenges
  if (!isStaff || !all) {
    conditions.push(eq(codingChallengesTable.isPublished, true));
  }
  if (courseId) conditions.push(eq(codingChallengesTable.courseId, parseInt(courseId)));
  if (difficulty) conditions.push(eq(codingChallengesTable.difficulty, difficulty as any));
  if (language) conditions.push(eq(codingChallengesTable.language, language as any));
  if (type) conditions.push(eq(codingChallengesTable.type, type as any));

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(codingChallengesTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(codingChallengesTable.createdAt))
      : await db
          .select()
          .from(codingChallengesTable)
          .orderBy(desc(codingChallengesTable.createdAt));

  // Attach submission count for current user
  const withCounts = await Promise.all(
    rows.map(async (c) => {
      const [row] = await db
        .select({ attempts: count() })
        .from(challengeSubmissionsTable)
        .where(
          and(
            eq(challengeSubmissionsTable.challengeId, c.id),
            eq(challengeSubmissionsTable.studentId, req.user!.id),
          ),
        );
      const hasPassed = await db
        .select({ c: count() })
        .from(challengeSubmissionsTable)
        .where(
          and(
            eq(challengeSubmissionsTable.challengeId, c.id),
            eq(challengeSubmissionsTable.studentId, req.user!.id),
            eq(challengeSubmissionsTable.status, "passed"),
          ),
        )
        .then(([r]) => (r?.c ?? 0) > 0);
      return serializeChallenge(c, {
        myAttempts: row?.attempts ?? 0,
        mySolved: hasPassed,
      });
    }),
  );

  res.json(withCounts);
});

// ─── Create challenge ─────────────────────────────────────────────────────────

router.post(
  "/challenges",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const {
      title, description, instructions, difficulty, type, language,
      starterCode, solutionCode, courseId, moduleId, maxAttempts,
      timeLimitMs, memoryLimitMb, isPublished, points, tags,
    } = req.body;

    if (!title || !description || !language) {
      res.status(400).json({ error: "title, description, and language are required" });
      return;
    }

    const [challenge] = await db
      .insert(codingChallengesTable)
      .values({
        title,
        description,
        instructions: instructions ?? null,
        difficulty: difficulty ?? "easy",
        type: type ?? "practice",
        language,
        starterCode: starterCode ?? null,
        solutionCode: solutionCode ?? null,
        courseId: courseId ? parseInt(courseId) : null,
        moduleId: moduleId ? parseInt(moduleId) : null,
        maxAttempts: maxAttempts ? parseInt(maxAttempts) : null,
        timeLimitMs: timeLimitMs ? parseInt(timeLimitMs) : 10_000,
        memoryLimitMb: memoryLimitMb ? parseInt(memoryLimitMb) : 128,
        isPublished: isPublished === true || isPublished === "true",
        points: points ? parseInt(points) : 100,
        tags: tags ?? null,
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json(serializeChallenge(challenge));
  },
);

// ─── Get challenge ────────────────────────────────────────────────────────────

router.get("/challenges/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const isStaff = req.user!.role === "admin" || req.user!.role === "mentor";

  const [challenge] = await db
    .select()
    .from(codingChallengesTable)
    .where(eq(codingChallengesTable.id, id));

  if (!challenge) { res.status(404).json({ error: "Challenge not found" }); return; }
  if (!isStaff && !challenge.isPublished) {
    res.status(404).json({ error: "Challenge not found" }); return;
  }

  // Public test cases only for students
  const testCases = await db
    .select()
    .from(challengeTestCasesTable)
    .where(
      isStaff
        ? eq(challengeTestCasesTable.challengeId, id)
        : and(
            eq(challengeTestCasesTable.challengeId, id),
            eq(challengeTestCasesTable.isHidden, false),
          ),
    )
    .orderBy(challengeTestCasesTable.order);

  const [{ attempts }] = await db
    .select({ attempts: count() })
    .from(challengeSubmissionsTable)
    .where(
      and(
        eq(challengeSubmissionsTable.challengeId, id),
        eq(challengeSubmissionsTable.studentId, req.user!.id),
      ),
    );

  const [{ allTestCount }] = await db
    .select({ allTestCount: count() })
    .from(challengeTestCasesTable)
    .where(eq(challengeTestCasesTable.challengeId, id));

  res.json({
    ...serializeChallenge(challenge, isStaff ? { solutionCode: challenge.solutionCode } : {}),
    testCases,
    totalTestCases: allTestCount,
    myAttempts: attempts,
  });
});

// ─── Update challenge ─────────────────────────────────────────────────────────

router.patch(
  "/challenges/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    const allowed = [
      "title", "description", "instructions", "difficulty", "type",
      "language", "starterCode", "solutionCode", "courseId", "moduleId",
      "maxAttempts", "timeLimitMs", "memoryLimitMb", "isPublished", "points", "tags",
    ];
    const update: Record<string, any> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const [challenge] = await db
      .update(codingChallengesTable)
      .set(update)
      .where(eq(codingChallengesTable.id, id))
      .returning();

    if (!challenge) { res.status(404).json({ error: "Challenge not found" }); return; }
    res.json(serializeChallenge(challenge));
  },
);

// ─── Delete challenge ─────────────────────────────────────────────────────────

router.delete(
  "/challenges/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(codingChallengesTable)
      .where(eq(codingChallengesTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Challenge not found" }); return; }
    res.sendStatus(204);
  },
);

// ─── Test cases ───────────────────────────────────────────────────────────────

router.get(
  "/challenges/:id/test-cases",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    const isStaff = req.user!.role === "admin" || req.user!.role === "mentor";

    const testCases = await db
      .select()
      .from(challengeTestCasesTable)
      .where(
        isStaff
          ? eq(challengeTestCasesTable.challengeId, id)
          : and(
              eq(challengeTestCasesTable.challengeId, id),
              eq(challengeTestCasesTable.isHidden, false),
            ),
      )
      .orderBy(challengeTestCasesTable.order);

    res.json(testCases);
  },
);

router.post(
  "/challenges/:id/test-cases",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const challengeId = parseInt(req.params.id);
    const { input = "", expectedOutput, isHidden = false, description, points = 10, order } = req.body;

    if (!expectedOutput) {
      res.status(400).json({ error: "expectedOutput is required" }); return;
    }

    // Auto-assign order if not provided
    const effectiveOrder = order !== undefined
      ? parseInt(order)
      : await db
          .select({ c: count() })
          .from(challengeTestCasesTable)
          .where(eq(challengeTestCasesTable.challengeId, challengeId))
          .then(([r]) => r?.c ?? 0);

    const [tc] = await db
      .insert(challengeTestCasesTable)
      .values({
        challengeId,
        input,
        expectedOutput,
        isHidden: isHidden === true || isHidden === "true",
        description: description ?? null,
        points: parseInt(points),
        order: effectiveOrder,
      })
      .returning();

    res.status(201).json(tc);
  },
);

router.delete(
  "/test-cases/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(challengeTestCasesTable)
      .where(eq(challengeTestCasesTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Test case not found" }); return; }
    res.sendStatus(204);
  },
);

// ─── Submit solution ──────────────────────────────────────────────────────────

router.post(
  "/challenges/:id/submit",
  requireAuth,
  async (req, res): Promise<void> => {
    const challengeId = parseInt(req.params.id);
    const userId = req.user!.id;
    const { code, language } = req.body as { code?: string; language?: string };

    if (!code || !language) {
      res.status(400).json({ error: "code and language are required" }); return;
    }

    // Get challenge
    const [challenge] = await db
      .select()
      .from(codingChallengesTable)
      .where(eq(codingChallengesTable.id, challengeId));
    if (!challenge) { res.status(404).json({ error: "Challenge not found" }); return; }

    // Check max attempts
    const [{ attemptCount }] = await db
      .select({ attemptCount: count() })
      .from(challengeSubmissionsTable)
      .where(
        and(
          eq(challengeSubmissionsTable.challengeId, challengeId),
          eq(challengeSubmissionsTable.studentId, userId),
        ),
      );

    if (challenge.maxAttempts && attemptCount >= challenge.maxAttempts) {
      res.status(400).json({
        error: `Maximum attempts (${challenge.maxAttempts}) reached`,
      });
      return;
    }

    // Get all test cases
    const testCases = await db
      .select()
      .from(challengeTestCasesTable)
      .where(eq(challengeTestCasesTable.challengeId, challengeId))
      .orderBy(challengeTestCasesTable.order);

    // Create pending submission
    const [submission] = await db
      .insert(challengeSubmissionsTable)
      .values({
        challengeId,
        studentId: userId,
        code,
        language: language as SupportedLanguage,
        status: "running",
        attemptNumber: attemptCount + 1,
        totalTests: testCases.length,
        maxScore: challenge.points,
      })
      .returning();

    // Run all test cases sequentially (safer resource-wise)
    let passedTests = 0;
    let earnedPoints = 0;
    let maxExecTime = 0;
    let hasTimeout = false;
    let hasError = false;

    const testResults: Array<{
      submissionId: number;
      testCaseId: number;
      passed: boolean;
      actualOutput: string | null;
      executionTimeMs: number | null;
      errorMessage: string | null;
    }> = [];

    for (const tc of testCases) {
      const result = await runTestCase({
        code,
        language: language as SupportedLanguage,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        timeoutMs: challenge.timeLimitMs,
      });

      testResults.push({
        submissionId: submission.id,
        testCaseId: tc.id,
        passed: result.passed,
        actualOutput: result.actualOutput,
        executionTimeMs: result.executionTimeMs,
        errorMessage: result.error ?? null,
      });

      if (result.passed) { passedTests++; earnedPoints += tc.points; }
      if (result.executionTimeMs > maxExecTime) maxExecTime = result.executionTimeMs;
      if (result.error?.includes("timeout") || result.error?.includes("timed out")) hasTimeout = true;
      else if (result.error) hasError = true;
    }

    // Calculate score
    const totalPossiblePoints = testCases.reduce((s, t) => s + t.points, 0);
    const scorePercent =
      totalPossiblePoints > 0
        ? Math.round((earnedPoints / totalPossiblePoints) * challenge.points)
        : 0;

    // Determine status
    const status: "passed" | "partial" | "failed" | "error" | "timeout" =
      hasTimeout
        ? "timeout"
        : passedTests === 0 && hasError
          ? "error"
          : passedTests === testCases.length
            ? "passed"
            : passedTests > 0
              ? "partial"
              : "failed";

    // Generate human-readable feedback
    const feedbackLines = [
      `Passed ${passedTests} of ${testCases.length} test cases.`,
    ];
    if (status === "passed") feedbackLines.push("Excellent work! All tests passed.");
    else if (status === "partial") feedbackLines.push("Some tests failed. Review the failing cases and try again.");
    else if (status === "timeout") feedbackLines.push("Your solution exceeded the time limit. Optimize for efficiency.");
    else if (status === "error") feedbackLines.push("A runtime error occurred. Check your code for exceptions.");
    else feedbackLines.push("No tests passed. Re-read the problem statement carefully.");

    const feedback = feedbackLines.join(" ");

    // Persist test results
    if (testResults.length > 0) {
      await db.insert(submissionTestResultsTable).values(testResults);
    }

    // Finalize submission
    const [finalSubmission] = await db
      .update(challengeSubmissionsTable)
      .set({ status, score: scorePercent, passedTests, executionTimeMs: maxExecTime, feedback })
      .where(eq(challengeSubmissionsTable.id, submission.id))
      .returning();

    // Update streak asynchronously
    updateStreak(userId, status === "passed").catch(() => {});

    // Return results (hide hidden test case expected output from students)
    const isStaff = req.user!.role === "admin" || req.user!.role === "mentor";
    const tcMap = new Map(testCases.map((t) => [t.id, t]));

    res.status(201).json({
      submission: finalSubmission,
      testResults: testResults.map((r) => {
        const tc = tcMap.get(r.testCaseId)!;
        return {
          ...r,
          description: tc.description,
          isHidden: tc.isHidden,
          input: tc.isHidden && !isStaff ? undefined : tc.input,
          expectedOutput: tc.isHidden && !isStaff ? undefined : tc.expectedOutput,
        };
      }),
    });
  },
);

// ─── List submissions ─────────────────────────────────────────────────────────

router.get(
  "/challenges/:id/submissions",
  requireAuth,
  async (req, res): Promise<void> => {
    const challengeId = parseInt(req.params.id);
    const userId = req.user!.id;
    const isStaff = req.user!.role === "admin" || req.user!.role === "mentor";

    const rows = await db
      .select({
        submission: challengeSubmissionsTable,
        studentName: usersTable.name,
        studentEmail: usersTable.email,
      })
      .from(challengeSubmissionsTable)
      .leftJoin(usersTable, eq(challengeSubmissionsTable.studentId, usersTable.id))
      .where(
        isStaff
          ? eq(challengeSubmissionsTable.challengeId, challengeId)
          : and(
              eq(challengeSubmissionsTable.challengeId, challengeId),
              eq(challengeSubmissionsTable.studentId, userId),
            ),
      )
      .orderBy(desc(challengeSubmissionsTable.submittedAt));

    res.json(
      rows.map((r) => ({
        ...r.submission,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
      })),
    );
  },
);

export default router;
