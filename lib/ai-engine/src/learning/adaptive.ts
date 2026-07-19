/**
 * Adaptive Learning Engine
 *
 * Drives personalized learning on JOE Forge by maintaining a per-user
 * competency model, detecting skill gaps, identifying at-risk students,
 * and generating learning recommendations — entirely on-device with no
 * external AI services.
 *
 * Competency model:
 *   Each student has a skill profile: a map of topic → score (0-100).
 *   Scores are a weighted moving average of all assessment events
 *   (challenge submissions, quiz attempts, AI evaluations).
 *
 * Risk detection:
 *   A student is flagged as at-risk when their pass rate falls below a
 *   threshold AND their activity drops, which predicts early dropout.
 *
 * Learning velocity:
 *   The rate at which a student completes assessable items, computed as an
 *   exponentially-weighted moving average over a sliding window.
 */

// ─── Competency topic taxonomy ─────────────────────────────────────────────────

// Maps broad skill areas to the topic tags that contribute to them.
// A challenge or quiz tagged with any of these contributes to the parent skill.
export const SKILL_TAXONOMY: Record<string, string[]> = {
  "Programming Fundamentals":    ["variables", "types", "operators", "conditionals", "loops", "functions"],
  "Data Structures":             ["arrays", "objects", "linked-list", "stack", "queue", "hash-map", "tree", "graph"],
  "Algorithms":                  ["sorting", "searching", "recursion", "dynamic-programming", "greedy", "backtracking"],
  "JavaScript":                  ["javascript", "js", "es6", "promises", "async", "dom", "events"],
  "Python":                      ["python", "py", "list-comprehension", "generators", "decorators"],
  "Databases":                   ["sql", "database", "orm", "queries", "joins", "indexing"],
  "Web Development":             ["html", "css", "react", "typescript", "api", "rest", "http"],
  "System Design":               ["architecture", "scalability", "caching", "load-balancing", "microservices"],
  "Software Engineering":        ["git", "testing", "debugging", "code-quality", "refactoring", "patterns"],
  "Career Readiness":            ["resume", "interview", "portfolio", "linkedin", "github"],
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LearningProfile {
  userId: number;
  skillScores: Record<string, number>;        // topic → 0-100
  weakTopics: string[];                       // topics below WEAK_THRESHOLD
  strongTopics: string[];                     // topics above STRONG_THRESHOLD
  learningVelocity: number;                   // items completed per week
  riskLevel: "none" | "low" | "medium" | "high";
  competencyScore: number;                    // overall 0-100
  totalAIInteractions: number;
  preferredMode: string | null;
  lastAssessedAt: Date | null;
}

export interface SkillAssessmentEvent {
  skillArea: string;
  score: number;                              // 0-100
  source: "challenge" | "quiz" | "assignment" | "ai_eval";
  weight?: number;                            // default 1.0
  timestamp: Date;
}

export interface LearningRecommendation {
  type: "strengthen_weak" | "advance_strong" | "resume_progress" | "practice_more" | "seek_help";
  skillArea: string;
  detail: string;
  priority: "high" | "medium" | "low";
  actionItems: string[];
}

export interface PerformanceForecast {
  predictedCompetencyScore: number;
  confidenceLevel: "high" | "medium" | "low";
  weeksToTargetScore: number | null;
  trend: "improving" | "stable" | "declining";
  onTrackForCompletion: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const WEAK_THRESHOLD   = 60;   // below this → weak topic
const STRONG_THRESHOLD = 80;   // above this → strong topic
const EWM_ALPHA        = 0.3;  // exponential moving average decay (0 = slow, 1 = fast)

// ─── Skill score computation ───────────────────────────────────────────────────

/**
 * Merge a new assessment event into existing skill scores using an
 * exponentially-weighted moving average (EWM). Recent scores count more.
 *
 * EWM: newScore = α × event + (1-α) × currentScore
 * First observation: newScore = event.score
 */
export function updateSkillScore(
  currentScores: Record<string, number>,
  event: SkillAssessmentEvent,
): Record<string, number> {
  const updated = { ...currentScores };
  const key = normalizeTopicKey(event.skillArea);
  const alpha = EWM_ALPHA * (event.weight ?? 1.0);

  if (updated[key] === undefined) {
    updated[key] = event.score;
  } else {
    updated[key] = Math.round(alpha * event.score + (1 - alpha) * updated[key]);
  }

  // Also contribute to parent taxonomy skill if applicable
  for (const [parent, tags] of Object.entries(SKILL_TAXONOMY)) {
    if (tags.some((t) => key.includes(t) || t.includes(key))) {
      const parentKey = normalizeTopicKey(parent);
      if (updated[parentKey] === undefined) {
        updated[parentKey] = event.score;
      } else {
        updated[parentKey] = Math.round(
          (EWM_ALPHA / 2) * event.score + (1 - EWM_ALPHA / 2) * updated[parentKey],
        );
      }
    }
  }

  return updated;
}

function normalizeTopicKey(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── Profile computation ───────────────────────────────────────────────────────

export function computeWeakAndStrongTopics(skillScores: Record<string, number>): {
  weak: string[];
  strong: string[];
} {
  const entries = Object.entries(skillScores);
  return {
    weak:   entries.filter(([, s]) => s < WEAK_THRESHOLD).map(([k]) => k).sort(),
    strong: entries.filter(([, s]) => s >= STRONG_THRESHOLD).map(([k]) => k).sort(),
  };
}

export function computeCompetencyScore(skillScores: Record<string, number>): number {
  const values = Object.values(skillScores);
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(Math.min(100, Math.max(0, avg)));
}

// ─── Learning velocity ─────────────────────────────────────────────────────────

/**
 * Calculate learning velocity as an exponentially-weighted rate of completion
 * events over a sliding time window.
 *
 * @param timestamps - UTC timestamps of completion events (submissions, quiz passes, etc.)
 * @param windowDays - How many days to look back
 * @returns Estimated completions per week
 */
export function calculateLearningVelocity(
  timestamps: Date[],
  windowDays = 28,
): number {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const recent = timestamps.filter((t) => now - t.getTime() <= windowMs);
  if (recent.length === 0) return 0;

  // EWM: weight each event by recency
  let weightedCount = 0;
  let totalWeight = 0;
  for (const ts of recent) {
    const ageMs = now - ts.getTime();
    const weight = Math.exp(-ageMs / (windowMs / 2));
    weightedCount += weight;
    totalWeight += weight;
  }

  const effectiveCount = totalWeight > 0 ? (weightedCount / totalWeight) * recent.length : 0;
  return Math.round((effectiveCount / windowDays) * 7 * 10) / 10; // per week
}

// ─── Risk detection ────────────────────────────────────────────────────────────

export interface RiskInput {
  passRate: number;            // 0-1 challenge/quiz pass rate
  learningVelocity: number;   // completions per week
  daysSinceLastActivity: number;
  competencyScore: number;    // 0-100
  aiInteractionCount: number;
  coursesEnrolled: number;
}

export function detectRiskLevel(
  input: RiskInput,
): "none" | "low" | "medium" | "high" {
  let riskScore = 0;

  // Low pass rate
  if (input.passRate < 0.3)       riskScore += 3;
  else if (input.passRate < 0.5)  riskScore += 1;

  // Very slow progress
  if (input.learningVelocity < 0.5)  riskScore += 2;
  else if (input.learningVelocity < 1) riskScore += 1;

  // Long inactivity
  if (input.daysSinceLastActivity > 14) riskScore += 3;
  else if (input.daysSinceLastActivity > 7) riskScore += 1;

  // Low overall competency
  if (input.competencyScore < 30) riskScore += 2;
  else if (input.competencyScore < 50) riskScore += 1;

  // Low AI engagement despite struggles
  if (input.passRate < 0.5 && input.aiInteractionCount < 3) riskScore += 1;

  if (riskScore >= 7) return "high";
  if (riskScore >= 4) return "medium";
  if (riskScore >= 2) return "low";
  return "none";
}

// ─── Learning recommendations ──────────────────────────────────────────────────

export function generateAdaptiveRecommendations(
  profile: Pick<LearningProfile, "skillScores" | "weakTopics" | "strongTopics" | "riskLevel" | "learningVelocity" | "competencyScore">,
): LearningRecommendation[] {
  const recommendations: LearningRecommendation[] = [];

  // 1. Prioritise weakest topics
  const weakSorted = Object.entries(profile.skillScores)
    .filter(([k]) => profile.weakTopics.includes(k))
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  for (const [topic, score] of weakSorted) {
    recommendations.push({
      type: "strengthen_weak",
      skillArea: topic,
      detail: `Your ${topic} score is ${score}/100. Focused practice here will have the biggest impact on your overall competency.`,
      priority: score < 40 ? "high" : "medium",
      actionItems: [
        `Complete 3 practice challenges tagged with "${topic}"`,
        `Ask the AI Tutor to explain ${topic} concepts in depth`,
        `Review course lessons covering ${topic}`,
      ],
    });
  }

  // 2. Advance strong topics to mastery
  const strongSorted = Object.entries(profile.skillScores)
    .filter(([k]) => profile.strongTopics.includes(k))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 1);

  for (const [topic, score] of strongSorted) {
    recommendations.push({
      type: "advance_strong",
      skillArea: topic,
      detail: `You're strong in ${topic} (${score}/100). Level up with advanced challenges to reach mastery.`,
      priority: "low",
      actionItems: [
        `Attempt hard-difficulty ${topic} challenges`,
        `Contribute to a team project using ${topic}`,
        `Mentor a peer who is struggling with ${topic}`,
      ],
    });
  }

  // 3. Risk-based recommendations
  if (profile.riskLevel === "high" || profile.riskLevel === "medium") {
    recommendations.push({
      type: "seek_help",
      skillArea: "Overall Progress",
      detail: "Your progress pattern suggests you may be falling behind. Connect with your mentor and use the AI Tutor daily.",
      priority: "high",
      actionItems: [
        "Book a session with your mentor",
        "Use the AI Tutor every day for at least 15 minutes",
        "Complete at least 1 challenge per day to rebuild momentum",
        "Reach out in the community forum — your peers can help",
      ],
    });
  }

  // 4. Low velocity recommendation
  if (profile.learningVelocity < 1 && profile.riskLevel === "none") {
    recommendations.push({
      type: "practice_more",
      skillArea: "Learning Pace",
      detail: "You're progressing slowly. Aim for at least 2 challenges or lessons per week to stay on track.",
      priority: "medium",
      actionItems: [
        "Set a daily study schedule and stick to it",
        "Start with easier challenges to build momentum",
        "Use the AI Tutor to get unstuck faster",
      ],
    });
  }

  return recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

// ─── Performance forecasting ───────────────────────────────────────────────────

/**
 * Simple linear extrapolation of competency score trajectory.
 * Uses last N assessment scores to estimate a slope, then projects forward.
 */
export function forecastPerformance(
  historicalScores: Array<{ score: number; daysAgo: number }>,
  weeksRemaining: number,
  targetScore = 70,
): PerformanceForecast {
  if (historicalScores.length < 2) {
    return {
      predictedCompetencyScore: historicalScores[0]?.score ?? 50,
      confidenceLevel: "low",
      weeksToTargetScore: null,
      trend: "stable",
      onTrackForCompletion: false,
    };
  }

  // Least-squares slope over days
  const n = historicalScores.length;
  const xs = historicalScores.map((h) => -h.daysAgo); // make positive = recent
  const ys = historicalScores.map((h) => h.score);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const sxy = xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0);
  const sxx = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
  const slope = sxx > 0 ? sxy / sxx : 0; // points per day

  const currentScore = yMean + slope * (0 - xMean); // projected to today
  const projectedScore = Math.max(0, Math.min(100, currentScore + slope * weeksRemaining * 7));

  const trend: PerformanceForecast["trend"] =
    slope > 0.5 ? "improving" : slope < -0.5 ? "declining" : "stable";

  const daysToTarget = slope > 0 ? (targetScore - currentScore) / slope : null;
  const weeksToTarget = daysToTarget !== null ? Math.ceil(daysToTarget / 7) : null;

  return {
    predictedCompetencyScore: Math.round(projectedScore),
    confidenceLevel: n >= 5 ? "high" : n >= 3 ? "medium" : "low",
    weeksToTargetScore: weeksToTarget !== null && weeksToTarget > 0 ? weeksToTarget : null,
    trend,
    onTrackForCompletion: projectedScore >= targetScore && (weeksToTarget === null || weeksToTarget <= weeksRemaining),
  };
}
