/**
 * AI Personalisation routes
 *
 * GET  /ai/learning/profile              — get/create learning profile for current user
 * POST /ai/learning/skill-assessment     — record a skill assessment event
 * GET  /ai/learning/recommendations      — get personalised learning recommendations
 * GET  /ai/learning/forecast             — get performance forecast
 * GET  /ai/learning/weak-topics          — get weak topics list
 * GET  /ai/learning/at-risk              — list at-risk students (admin/mentor only)
 */
import { Router } from "express";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  aiLearningProfilesTable,
  aiSkillAssessmentsTable,
  challengeSubmissionsTable,
} from "@workspace/db";
import {
  updateSkillScore,
  computeWeakAndStrongTopics,
  computeCompetencyScore,
  calculateLearningVelocity,
  detectRiskLevel,
  generateAdaptiveRecommendations,
  forecastPerformance,
} from "@workspace/ai-engine/learning/adaptive";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateProfile(userId: number) {
  const [existing] = await db
    .select()
    .from(aiLearningProfilesTable)
    .where(eq(aiLearningProfilesTable.userId, userId));
  if (existing) return existing;

  const [created] = await db
    .insert(aiLearningProfilesTable)
    .values({ userId })
    .returning();
  return created;
}

async function recomputeAndSaveProfile(userId: number) {
  const profile = await getOrCreateProfile(userId);

  // Pull last 30 skill assessments to compute skill scores
  const assessments = await db
    .select()
    .from(aiSkillAssessmentsTable)
    .where(eq(aiSkillAssessmentsTable.userId, userId))
    .orderBy(aiSkillAssessmentsTable.createdAt);

  // Build skill score map via EWM
  let skillScores: Record<string, number> = {};
  for (const a of assessments) {
    skillScores = updateSkillScore(skillScores, {
      skillArea: a.skillArea,
      score: a.score,
      source: a.source as "challenge" | "quiz" | "assignment" | "ai_eval",
      timestamp: a.createdAt,
    });
  }

  const { weak, strong } = computeWeakAndStrongTopics(skillScores);
  const competencyScore = computeCompetencyScore(skillScores);

  // Learning velocity from challenge submissions
  const submissions = await db
    .select({ createdAt: challengeSubmissionsTable.createdAt })
    .from(challengeSubmissionsTable)
    .where(
      and(
        eq(challengeSubmissionsTable.userId, userId),
        gte(challengeSubmissionsTable.createdAt, new Date(Date.now() - 28 * 24 * 60 * 60 * 1000))
      )
    );
  const learningVelocity = calculateLearningVelocity(submissions.map((s) => s.createdAt));

  // Risk level
  const lastSubmission = submissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const daysSinceLastActivity = lastSubmission
    ? Math.floor((Date.now() - lastSubmission.createdAt.getTime()) / 86400000)
    : 30;

  const allSubmissions = await db
    .select({ passed: challengeSubmissionsTable.passed })
    .from(challengeSubmissionsTable)
    .where(eq(challengeSubmissionsTable.userId, userId));

  const passRate = allSubmissions.length > 0
    ? allSubmissions.filter((s) => s.passed).length / allSubmissions.length
    : 0;

  const riskLevel = detectRiskLevel({
    passRate,
    learningVelocity,
    daysSinceLastActivity,
    competencyScore,
    aiInteractionCount: profile.totalAIInteractions,
    coursesEnrolled: 1,
  });

  // Recommendations
  const recommendations = generateAdaptiveRecommendations({
    skillScores,
    weakTopics: weak,
    strongTopics: strong,
    riskLevel,
    learningVelocity,
    competencyScore,
  });

  // Save updated profile
  const [updated] = await db
    .update(aiLearningProfilesTable)
    .set({
      skillScores,
      weakTopics: weak,
      strongTopics: strong,
      competencyScore,
      learningVelocity,
      riskLevel,
      recommendations,
      lastAssessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiLearningProfilesTable.userId, userId))
    .returning();

  return updated;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/ai/learning/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const profile = await recomputeAndSaveProfile(userId);

  // Recent skill assessments (last 10)
  const recentAssessments = await db
    .select()
    .from(aiSkillAssessmentsTable)
    .where(eq(aiSkillAssessmentsTable.userId, userId))
    .orderBy(desc(aiSkillAssessmentsTable.createdAt))
    .limit(10);

  res.json({ profile, recentAssessments });
});

router.post("/ai/learning/skill-assessment", requireAuth, async (req, res): Promise<void> => {
  const { skillArea, score, source, sourceId } = req.body;
  if (!skillArea || score === undefined || !source) {
    res.status(400).json({ error: "skillArea, score, and source required" }); return;
  }
  if (typeof score !== "number" || score < 0 || score > 100) {
    res.status(400).json({ error: "score must be 0-100" }); return;
  }

  const userId = req.user!.id;

  // Record the assessment event
  await db.insert(aiSkillAssessmentsTable).values({
    userId,
    skillArea,
    score,
    source,
    sourceId: sourceId ?? null,
  });

  // Recompute profile
  const updated = await recomputeAndSaveProfile(userId);

  res.json({
    updated: true,
    skillArea,
    newScore: updated.skillScores[skillArea.toLowerCase().replace(/\s+/g, "-")] ?? score,
    profile: {
      competencyScore: updated.competencyScore,
      weakTopics: updated.weakTopics,
      strongTopics: updated.strongTopics,
      riskLevel: updated.riskLevel,
    },
  });
});

router.get("/ai/learning/recommendations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const profile = await recomputeAndSaveProfile(userId);
  res.json({ recommendations: profile.recommendations });
});

router.get("/ai/learning/forecast", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  // Get historical competency from assessments over time
  const assessments = await db
    .select()
    .from(aiSkillAssessmentsTable)
    .where(eq(aiSkillAssessmentsTable.userId, userId))
    .orderBy(aiSkillAssessmentsTable.createdAt);

  // Build a timeline of competency scores (monthly snapshots)
  const monthly: Record<string, number[]> = {};
  let rollingScores: Record<string, number> = {};
  for (const a of assessments) {
    rollingScores = updateSkillScore(rollingScores, {
      skillArea: a.skillArea,
      score: a.score,
      source: a.source as "challenge" | "quiz" | "assignment" | "ai_eval",
      timestamp: a.createdAt,
    });
    const month = a.createdAt.toISOString().slice(0, 7);
    if (!monthly[month]) monthly[month] = [];
    monthly[month].push(computeCompetencyScore(rollingScores));
  }

  const historicalScores = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, scores], i, arr) => ({
      score: scores[scores.length - 1],
      daysAgo: (arr.length - 1 - i) * 30,
    }));

  const weeksRemaining = parseInt(String(req.query.weeksRemaining ?? "8"));
  const forecast = forecastPerformance(historicalScores, weeksRemaining);

  res.json(forecast);
});

router.get("/ai/learning/weak-topics", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [profile] = await db
    .select()
    .from(aiLearningProfilesTable)
    .where(eq(aiLearningProfilesTable.userId, userId));

  if (!profile) {
    res.json({ weakTopics: [], skillScores: {} }); return;
  }
  res.json({
    weakTopics: profile.weakTopics,
    strongTopics: profile.strongTopics,
    skillScores: profile.skillScores,
    competencyScore: profile.competencyScore,
  });
});

// Admin/mentor only: list at-risk students
router.get("/ai/learning/at-risk", requireAuth, requireRole("admin", "mentor"), async (_req, res): Promise<void> => {
  const atRisk = await db
    .select({
      userId: aiLearningProfilesTable.userId,
      riskLevel: aiLearningProfilesTable.riskLevel,
      competencyScore: aiLearningProfilesTable.competencyScore,
      learningVelocity: aiLearningProfilesTable.learningVelocity,
      weakTopics: aiLearningProfilesTable.weakTopics,
      lastAssessedAt: aiLearningProfilesTable.lastAssessedAt,
    })
    .from(aiLearningProfilesTable)
    .where(sql`${aiLearningProfilesTable.riskLevel} IN ('high', 'medium')`)
    .orderBy(desc(aiLearningProfilesTable.updatedAt));

  res.json({ atRiskStudents: atRisk, total: atRisk.length });
});

export default router;
