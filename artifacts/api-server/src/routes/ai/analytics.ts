/**
 * AI Analytics routes
 *
 * GET /ai/analytics/student/:userId  — individual student analytics
 * GET /ai/analytics/cohort/:cohortId — cohort-level analytics
 * GET /ai/analytics/platform         — platform-wide AI analytics
 */
import { Router } from "express";
import { eq, and, desc, count, avg, sql, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  aiConversationsTable,
  aiMessagesTable,
  aiFeedbackTable,
  aiLearningProfilesTable,
  aiSkillAssessmentsTable,
  challengeSubmissionsTable,
} from "@workspace/db";
import {
  computeStudentEngagementScore,
  computePerformanceScore,
  computeCohortAnalytics,
  computeAIUsageAnalytics,
} from "@workspace/ai-engine/analytics";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();
const adminOrMentor = [requireAuth, requireRole("admin", "mentor")];

// ─── Student Analytics ────────────────────────────────────────────────────────

router.get("/ai/analytics/student/:userId", requireAuth, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  // Only own data unless admin/mentor
  const me = req.user!;
  if (me.id !== userId && me.role !== "admin" && me.role !== "mentor") {
    res.status(403).json({ error: "Access denied" }); return;
  }

  // Fetch AI conversation + message stats
  const conversations = await db
    .select({ mode: aiConversationsTable.mode })
    .from(aiConversationsTable)
    .where(eq(aiConversationsTable.userId, userId));

  const [msgStats] = await db
    .select({
      totalMessages: count(),
      avgLatency: avg(aiMessagesTable.latencyMs),
    })
    .from(aiMessagesTable)
    .innerJoin(aiConversationsTable, eq(aiMessagesTable.conversationId, aiConversationsTable.id))
    .where(eq(aiConversationsTable.userId, userId));

  const ratings = await db
    .select({ rating: aiFeedbackTable.rating })
    .from(aiFeedbackTable)
    .where(eq(aiFeedbackTable.userId, userId));

  // Challenge submissions
  const submissions = await db
    .select({
      passed: challengeSubmissionsTable.passed,
      score: challengeSubmissionsTable.score,
      createdAt: challengeSubmissionsTable.createdAt,
    })
    .from(challengeSubmissionsTable)
    .where(eq(challengeSubmissionsTable.userId, userId));

  // Learning profile
  const [profile] = await db
    .select()
    .from(aiLearningProfilesTable)
    .where(eq(aiLearningProfilesTable.userId, userId));

  // Compute active days (rough estimate: unique calendar days with submissions)
  const daySet = new Set(submissions.map((s) => s.createdAt.toISOString().slice(0, 10)));
  const activeDays = daySet.size;

  // Compute longest streak (simplified: consecutive days in the day set)
  const sortedDays = [...daySet].sort();
  let longestStreak = sortedDays.length > 0 ? 1 : 0;
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
    if (diffDays === 1) { streak++; longestStreak = Math.max(longestStreak, streak); }
    else streak = 1;
  }

  const challengesPassed = submissions.filter((s) => s.passed).length;
  const challengePassRate = submissions.length > 0 ? challengesPassed / submissions.length : 0;
  const avgChallengeScore = submissions.length > 0
    ? submissions.reduce((a, s) => a + (s.score ?? 0), 0) / submissions.length
    : 0;

  const byMode: Record<string, number> = {};
  for (const c of conversations) { byMode[c.mode] = (byMode[c.mode] ?? 0) + 1; }

  const avgRating = ratings.length > 0
    ? ratings.reduce((a, r) => a + r.rating, 0) / ratings.length
    : null;

  const engagementScore = computeStudentEngagementScore({
    activeDays,
    totalAIMessages: Number(msgStats?.totalMessages ?? 0),
    challengesPassed,
    assignmentsSubmitted: 0,  // can extend later
    longestStreakDays: longestStreak,
  });

  const performanceScore = computePerformanceScore({
    challengePassRate,
    avgChallengeScore,
    quizAvgScore: 0,
    onTimeRate: 0,
  });

  res.json({
    userId,
    // Challenge stats
    challengesAttempted: submissions.length,
    challengesPassed,
    challengePassRate: Math.round(challengePassRate * 1000) / 10,
    avgChallengeScore: Math.round(avgChallengeScore),
    // AI usage
    totalAIConversations: conversations.length,
    totalAIMessages: Number(msgStats?.totalMessages ?? 0),
    aiConversationsByMode: byMode,
    avgAIRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
    // Engagement
    activeDays,
    longestStreakDays: longestStreak,
    // Learning profile
    competencyScore: profile?.competencyScore ?? 0,
    riskLevel: profile?.riskLevel ?? "none",
    weakTopics: profile?.weakTopics ?? [],
    strongTopics: profile?.strongTopics ?? [],
    learningVelocity: profile?.learningVelocity ?? 0,
    skillScores: profile?.skillScores ?? {},
    // Computed composites
    engagementScore,
    performanceScore,
  });
});

// ─── Cohort Analytics ─────────────────────────────────────────────────────────

router.get("/ai/analytics/cohort/:cohortId", ...adminOrMentor, async (req, res): Promise<void> => {
  const cohortId = parseInt(req.params.cohortId);
  if (isNaN(cohortId)) { res.status(400).json({ error: "Invalid cohortId" }); return; }

  // Get all users in this cohort
  const cohortUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.cohortId, cohortId));

  if (cohortUsers.length === 0) {
    res.json({ cohortId, message: "No students in cohort", students: [] }); return;
  }

  const userIds = cohortUsers.map((u) => u.id);

  // Fetch profiles for all cohort members
  const profiles = await db
    .select()
    .from(aiLearningProfilesTable)
    .where(sql`${aiLearningProfilesTable.userId} = ANY(${userIds})`);

  // Fetch recent submissions per user
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const submissionsRaw = await db
    .select({
      userId: challengeSubmissionsTable.userId,
      passed: challengeSubmissionsTable.passed,
      createdAt: challengeSubmissionsTable.createdAt,
    })
    .from(challengeSubmissionsTable)
    .where(
      sql`${challengeSubmissionsTable.userId} = ANY(${userIds}) AND ${challengeSubmissionsTable.createdAt} >= ${oneMonthAgo}`
    );

  // Build per-student analytics input
  const studentInputs = userIds.map((userId) => {
    const profile = profiles.find((p) => p.userId === userId);
    const subs = submissionsRaw.filter((s) => s.userId === userId);
    const passRate = subs.length > 0 ? subs.filter((s) => s.passed).length / subs.length : 0;

    // Days since last activity
    const lastSub = subs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const daysSince = lastSub
      ? Math.floor((Date.now() - lastSub.createdAt.getTime()) / 86400000)
      : 99;

    return {
      userId,
      competencyScore: profile?.competencyScore ?? 0,
      engagementScore: computeStudentEngagementScore({
        activeDays: 0, totalAIMessages: 0, challengesPassed: 0,
        assignmentsSubmitted: 0, longestStreakDays: 0,
      }),
      challengePassRate: passRate,
      daysSinceLastActivity: daysSince,
      riskLevel: profile?.riskLevel ?? "none",
    };
  });

  const analytics = computeCohortAnalytics(studentInputs, cohortId);

  res.json({
    ...analytics,
    profileCoverage: `${profiles.length}/${userIds.length} students have learning profiles`,
  });
});

// ─── Platform Analytics ───────────────────────────────────────────────────────

router.get("/ai/analytics/platform", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Aggregate AI usage
  const [totalConvs] = await db.select({ count: count() }).from(aiConversationsTable);
  const [totalMsgs] = await db.select({ count: count() }).from(aiMessagesTable);

  const recentConvs = await db
    .select({ mode: aiConversationsTable.mode })
    .from(aiConversationsTable)
    .where(gte(aiConversationsTable.createdAt, sevenDaysAgo));

  const [ratingStats] = await db
    .select({ avg: avg(aiFeedbackTable.rating), count: count() })
    .from(aiFeedbackTable);

  // Risk level breakdown
  const riskBreakdown = await db
    .select({ riskLevel: aiLearningProfilesTable.riskLevel, count: count() })
    .from(aiLearningProfilesTable)
    .groupBy(aiLearningProfilesTable.riskLevel);

  const [avgCompetency] = await db
    .select({ avg: avg(aiLearningProfilesTable.competencyScore) })
    .from(aiLearningProfilesTable);

  const byMode: Record<string, number> = {};
  for (const c of recentConvs) { byMode[c.mode] = (byMode[c.mode] ?? 0) + 1; }
  const topModes = Object.entries(byMode)
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    overview: {
      totalAIConversations: Number(totalConvs.count),
      totalAIMessages: Number(totalMsgs.count),
      avgMessageRating: ratingStats.avg ? Math.round(Number(ratingStats.avg) * 10) / 10 : null,
      totalFeedback: Number(ratingStats.count),
    },
    last7Days: {
      conversations: recentConvs.length,
      byMode: topModes,
    },
    learningProfiles: {
      avgCompetencyScore: avgCompetency.avg ? Math.round(Number(avgCompetency.avg)) : 0,
      riskBreakdown: Object.fromEntries(
        riskBreakdown.map((r) => [r.riskLevel, Number(r.count)])
      ),
    },
  });
});

export default router;
