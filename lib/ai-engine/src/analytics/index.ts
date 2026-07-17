/**
 * AI Analytics Engine
 *
 * Aggregates and analyses learning data to produce insights at three levels:
 *
 *  1. Student-level  — individual performance, engagement, trajectory
 *  2. Cohort-level   — comparative analysis across students in the same cohort
 *  3. Platform-level — aggregate usage, course effectiveness, AI utilisation
 *
 * All computation is deterministic and runs on-device. No external APIs.
 */

// ─── Student Analytics ─────────────────────────────────────────────────────────

export interface StudentAnalyticsSummary {
  userId: number;
  // Challenge performance
  challengesAttempted: number;
  challengesPassed: number;
  challengePassRate: number;
  avgChallengeScore: number;
  // Quiz performance
  quizzesAttempted: number;
  quizAvgScore: number;
  // Assignments
  assignmentsSubmitted: number;
  assignmentsOnTime: number;
  onTimeRate: number;
  // AI usage
  totalAIMessages: number;
  aiConversationsByMode: Record<string, number>;
  avgAIRating: number | null;
  // Engagement
  activeDays: number;
  longestStreakDays: number;
  lastActiveAt: Date | null;
  // Computed
  engagementScore: number;   // 0-100 composite of activity + AI usage
  performanceScore: number;  // 0-100 composite of challenge + quiz + assignment scores
}

export function computeStudentEngagementScore(params: {
  activeDays: number;
  totalAIMessages: number;
  challengesPassed: number;
  assignmentsSubmitted: number;
  longestStreakDays: number;
}): number {
  // Weighted composite — each factor normalised against a "target" value
  const activityComponent = Math.min(1, params.activeDays / 30) * 30;          // 30 pts max
  const aiUsageComponent  = Math.min(1, params.totalAIMessages / 50) * 25;     // 25 pts max
  const challengeComponent = Math.min(1, params.challengesPassed / 20) * 25;   // 25 pts max
  const streakComponent    = Math.min(1, params.longestStreakDays / 14) * 20;   // 20 pts max
  return Math.round(activityComponent + aiUsageComponent + challengeComponent + streakComponent);
}

export function computePerformanceScore(params: {
  challengePassRate: number;
  avgChallengeScore: number;
  quizAvgScore: number;
  onTimeRate: number;
}): number {
  return Math.round(
    params.challengePassRate    * 100 * 0.40 +
    params.avgChallengeScore          * 0.25 +
    params.quizAvgScore               * 0.20 +
    params.onTimeRate           * 100 * 0.15,
  );
}

// ─── Cohort Analytics ─────────────────────────────────────────────────────────

export interface CohortAnalytics {
  cohortId: number;
  totalStudents: number;
  activeStudents: number;        // active in last 7 days
  atRiskStudents: number;
  // Aggregate performance
  avgChallengePassRate: number;
  avgCompetencyScore: number;
  avgEngagementScore: number;
  // Distribution buckets
  performanceDistribution: {
    excellent: number; // > 80
    good: number;      // 60-80
    struggling: number;// 40-60
    atRisk: number;    // < 40
  };
  // Top and bottom performers (anonymised IDs only for privacy)
  topPerformerIds: number[];
  strugglingStudentIds: number[];
  // Weekly trend
  weeklyProgressTrend: "improving" | "stable" | "declining";
}

export function computeCohortAnalytics(
  students: Array<{
    userId: number;
    competencyScore: number;
    engagementScore: number;
    challengePassRate: number;
    daysSinceLastActivity: number;
    riskLevel: string;
    weeklyScores?: number[]; // last 4 weeks
  }>,
  cohortId: number,
): CohortAnalytics {
  const n = students.length;
  if (n === 0) {
    return {
      cohortId, totalStudents: 0, activeStudents: 0, atRiskStudents: 0,
      avgChallengePassRate: 0, avgCompetencyScore: 0, avgEngagementScore: 0,
      performanceDistribution: { excellent: 0, good: 0, struggling: 0, atRisk: 0 },
      topPerformerIds: [], strugglingStudentIds: [],
      weeklyProgressTrend: "stable",
    };
  }

  const avgCompetencyScore = students.reduce((s, st) => s + st.competencyScore, 0) / n;
  const avgEngagementScore = students.reduce((s, st) => s + st.engagementScore, 0) / n;
  const avgChallengePassRate = students.reduce((s, st) => s + st.challengePassRate, 0) / n;

  const activeStudents = students.filter((s) => s.daysSinceLastActivity <= 7).length;
  const atRiskStudents = students.filter((s) => s.riskLevel === "high" || s.riskLevel === "medium").length;

  const dist = { excellent: 0, good: 0, struggling: 0, atRisk: 0 };
  for (const st of students) {
    if (st.competencyScore > 80)      dist.excellent++;
    else if (st.competencyScore > 60) dist.good++;
    else if (st.competencyScore > 40) dist.struggling++;
    else                              dist.atRisk++;
  }

  const sorted = [...students].sort((a, b) => b.competencyScore - a.competencyScore);
  const topPerformerIds = sorted.slice(0, Math.min(3, Math.ceil(n * 0.1))).map((s) => s.userId);
  const strugglingStudentIds = sorted.slice(-Math.min(3, Math.ceil(n * 0.2))).map((s) => s.userId);

  // Trend: compare avg scores across weekly snapshots
  let weeklyProgressTrend: "improving" | "stable" | "declining" = "stable";
  const studentsWithTrend = students.filter((s) => s.weeklyScores && s.weeklyScores.length >= 2);
  if (studentsWithTrend.length > 0) {
    const avgTrendSlope = studentsWithTrend.reduce((acc, s) => {
      const scores = s.weeklyScores!;
      const delta = scores[scores.length - 1] - scores[0];
      return acc + delta;
    }, 0) / studentsWithTrend.length;
    if (avgTrendSlope > 2)        weeklyProgressTrend = "improving";
    else if (avgTrendSlope < -2)  weeklyProgressTrend = "declining";
  }

  return {
    cohortId, totalStudents: n, activeStudents, atRiskStudents,
    avgChallengePassRate: Math.round(avgChallengePassRate * 100) / 100,
    avgCompetencyScore: Math.round(avgCompetencyScore),
    avgEngagementScore: Math.round(avgEngagementScore),
    performanceDistribution: dist,
    topPerformerIds,
    strugglingStudentIds,
    weeklyProgressTrend,
  };
}

// ─── Course Effectiveness ──────────────────────────────────────────────────────

export interface CourseEffectivenessReport {
  courseId: number;
  completionRate: number;           // % of enrolled who completed
  avgPostCourseScore: number;       // competency score after completing
  avgPreCourseScore: number;        // competency score before
  skillLift: number;                // avgPost - avgPre
  dropOffLessonIndex: number | null; // lesson where most students stop
  avgTimeToCompleteWeeks: number;
  engagementByLesson: number[];     // interaction count per lesson
}

export function computeCourseEffectiveness(params: {
  courseId: number;
  enrolledCount: number;
  completedCount: number;
  preScores: number[];
  postScores: number[];
  lessonEngagements: number[];
  completionTimesWeeks: number[];
}): CourseEffectivenessReport {
  const avgPre  = params.preScores.length  > 0 ? params.preScores.reduce((a, b) => a + b, 0)  / params.preScores.length  : 0;
  const avgPost = params.postScores.length > 0 ? params.postScores.reduce((a, b) => a + b, 0) / params.postScores.length : 0;
  const avgTime = params.completionTimesWeeks.length > 0
    ? params.completionTimesWeeks.reduce((a, b) => a + b, 0) / params.completionTimesWeeks.length
    : 0;

  // Lesson with lowest relative engagement signals drop-off
  let dropOffLessonIndex: number | null = null;
  if (params.lessonEngagements.length > 1) {
    const maxEng = Math.max(...params.lessonEngagements);
    const dropIdx = params.lessonEngagements.findIndex((e) => e < maxEng * 0.5);
    if (dropIdx > 0) dropOffLessonIndex = dropIdx;
  }

  return {
    courseId: params.courseId,
    completionRate: params.enrolledCount > 0 ? params.completedCount / params.enrolledCount : 0,
    avgPreCourseScore: Math.round(avgPre),
    avgPostCourseScore: Math.round(avgPost),
    skillLift: Math.round(avgPost - avgPre),
    dropOffLessonIndex,
    avgTimeToCompleteWeeks: Math.round(avgTime * 10) / 10,
    engagementByLesson: params.lessonEngagements,
  };
}

// ─── Mentor Analytics ─────────────────────────────────────────────────────────

export interface MentorAnalytics {
  mentorId: number;
  totalStudentsAssigned: number;
  avgStudentCompetencyScore: number;
  avgStudentEngagementScore: number;
  studentsImproved: number;         // students who improved week-over-week
  studentsAtRisk: number;
  sessionsConducted: number;
  avgSessionRating: number | null;
  responseRatePercent: number;       // % of student messages responded to within 24h
}

// ─── AI Usage Analytics ────────────────────────────────────────────────────────

export interface AIUsageAnalytics {
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  conversationsByMode: Record<string, number>;
  avgRating: number | null;
  flaggedCount: number;
  flagRate: number;
  topUsedModes: Array<{ mode: string; count: number }>;
  dailyActiveAIUsers: number;
  avgLatencyMs: number | null;
}

export function computeAIUsageAnalytics(params: {
  conversations: Array<{ mode: string; messageCount: number }>;
  totalMessages: number;
  ratings: number[];
  flaggedCount: number;
  latencies: number[];
  uniqueUsersToday: number;
}): AIUsageAnalytics {
  const byMode: Record<string, number> = {};
  for (const c of params.conversations) {
    byMode[c.mode] = (byMode[c.mode] ?? 0) + 1;
  }

  const topUsedModes = Object.entries(byMode)
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const avgRating = params.ratings.length > 0
    ? Math.round((params.ratings.reduce((a, b) => a + b, 0) / params.ratings.length) * 10) / 10
    : null;

  const avgLatencyMs = params.latencies.length > 0
    ? Math.round(params.latencies.reduce((a, b) => a + b, 0) / params.latencies.length)
    : null;

  return {
    totalConversations: params.conversations.length,
    totalMessages: params.totalMessages,
    avgMessagesPerConversation: params.conversations.length > 0
      ? Math.round((params.totalMessages / params.conversations.length) * 10) / 10
      : 0,
    conversationsByMode: byMode,
    avgRating,
    flaggedCount: params.flaggedCount,
    flagRate: params.totalMessages > 0 ? params.flaggedCount / params.totalMessages : 0,
    topUsedModes,
    dailyActiveAIUsers: params.uniqueUsersToday,
    avgLatencyMs,
  };
}
