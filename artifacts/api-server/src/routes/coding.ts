/**
 * Coding progress & analytics routes:
 *
 * GET /coding/progress  - student coding stats (challenges solved, points, etc.)
 * GET /coding/streak    - current coding streak
 * GET /coding/leaderboard - top students by points
 * GET /coding/languages - supported language list
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, count, sum } from "drizzle-orm";
import {
  db,
  codingChallengesTable,
  challengeSubmissionsTable,
  codingStreaksTable,
  codeExecutionLogsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { LANGUAGE_INFO } from "../lib/executor";

const router: IRouter = Router();

// ─── Student progress ─────────────────────────────────────────────────────────

router.get("/coding/progress", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  // Total submissions + breakdown by status
  const submissions = await db
    .select()
    .from(challengeSubmissionsTable)
    .where(eq(challengeSubmissionsTable.studentId, userId));

  const totalSubmissions = submissions.length;
  const passedSubmissions = submissions.filter((s) => s.status === "passed").length;
  const totalPoints = submissions.reduce(
    (sum, s) => sum + (s.overrideScore ?? s.score),
    0,
  );

  // Distinct challenges solved
  const solvedChallengeIds = new Set(
    submissions.filter((s) => s.status === "passed").map((s) => s.challengeId),
  );

  // Total executions ("Run Code" clicks)
  const [{ execCount }] = await db
    .select({ execCount: count() })
    .from(codeExecutionLogsTable)
    .where(eq(codeExecutionLogsTable.userId, userId));

  // Language breakdown
  const langBreakdown: Record<string, number> = {};
  for (const s of submissions) {
    langBreakdown[s.language] = (langBreakdown[s.language] ?? 0) + 1;
  }

  // Recent submissions (last 10)
  const recentSubmissions = await db
    .select({
      id: challengeSubmissionsTable.id,
      challengeId: challengeSubmissionsTable.challengeId,
      status: challengeSubmissionsTable.status,
      score: challengeSubmissionsTable.score,
      submittedAt: challengeSubmissionsTable.submittedAt,
      challengeTitle: codingChallengesTable.title,
    })
    .from(challengeSubmissionsTable)
    .leftJoin(
      codingChallengesTable,
      eq(challengeSubmissionsTable.challengeId, codingChallengesTable.id),
    )
    .where(eq(challengeSubmissionsTable.studentId, userId))
    .orderBy(desc(challengeSubmissionsTable.submittedAt))
    .limit(10);

  // Streak
  const [streak] = await db
    .select()
    .from(codingStreaksTable)
    .where(eq(codingStreaksTable.userId, userId));

  res.json({
    totalSubmissions,
    passedSubmissions,
    totalPoints,
    solvedChallenges: solvedChallengeIds.size,
    totalExecutions: execCount,
    languageBreakdown: langBreakdown,
    recentSubmissions,
    streak: streak
      ? {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastActivityDate: streak.lastActivityDate,
          totalChallengesSolved: streak.totalChallengesSolved,
        }
      : { currentStreak: 0, longestStreak: 0, lastActivityDate: null, totalChallengesSolved: 0 },
  });
});

// ─── Streak ───────────────────────────────────────────────────────────────────

router.get("/coding/streak", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [streak] = await db
    .select()
    .from(codingStreaksTable)
    .where(eq(codingStreaksTable.userId, userId));

  res.json(
    streak ?? {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      totalChallengesSolved: 0,
      totalSubmissions: 0,
    },
  );
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

router.get(
  "/coding/leaderboard",
  requireAuth,
  async (req, res): Promise<void> => {
    // Top 20 students by total points earned
    const rows = await db
      .select({
        userId: challengeSubmissionsTable.studentId,
        name: usersTable.name,
        totalPoints: sum(challengeSubmissionsTable.score),
        solvedCount: count(),
      })
      .from(challengeSubmissionsTable)
      .leftJoin(usersTable, eq(challengeSubmissionsTable.studentId, usersTable.id))
      .where(eq(challengeSubmissionsTable.status, "passed"))
      .groupBy(challengeSubmissionsTable.studentId, usersTable.name)
      .orderBy(desc(sum(challengeSubmissionsTable.score)))
      .limit(20);

    res.json(
      rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: r.name,
        totalPoints: r.totalPoints ?? 0,
        solvedCount: r.solvedCount,
      })),
    );
  },
);

// ─── Supported languages ──────────────────────────────────────────────────────

router.get("/coding/languages", requireAuth, async (_req, res): Promise<void> => {
  const langs = Object.entries(LANGUAGE_INFO).map(([key, info]) => ({
    id: key,
    label: info.label,
    monacoId: info.monacoId,
    available: info.available(),
  }));
  res.json(langs);
});

// ─── Admin: platform coding analytics ────────────────────────────────────────

router.get(
  "/coding/analytics",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [{ totalChallenges }] = await db
      .select({ totalChallenges: count() })
      .from(codingChallengesTable);

    const [{ totalSubmissions }] = await db
      .select({ totalSubmissions: count() })
      .from(challengeSubmissionsTable);

    const [{ passedCount }] = await db
      .select({ passedCount: count() })
      .from(challengeSubmissionsTable)
      .where(eq(challengeSubmissionsTable.status, "passed"));

    const [{ totalExecutions }] = await db
      .select({ totalExecutions: count() })
      .from(codeExecutionLogsTable);

    const activeStreaks = await db
      .select({ count: count() })
      .from(codingStreaksTable)
      .where(
        and(
          // streak > 0
          eq(codingStreaksTable.currentStreak, 0),
        ),
      )
      .then(([r]) => r?.count ?? 0);

    res.json({
      totalChallenges,
      totalSubmissions,
      passedSubmissions: passedCount,
      passRate: totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0,
      totalExecutions,
    });
  },
);

export default router;
