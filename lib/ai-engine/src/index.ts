// AI Engine — public API
export { inferenceEngine, createInferenceEngine } from "./inference/index.js";
export type { ChatMessage, InferenceOptions, InferenceResult, StreamChunk } from "./inference/index.js";

export { indexDocument, deleteDocumentChunks, getKnowledgeStats, searchKnowledge } from "./knowledge/index.js";
export type { KnowledgeDocument, KnowledgeSourceType } from "./knowledge/index.js";

export { renderPrompt, sanitizeInput, truncateContext, BUILT_IN_PROMPTS } from "./prompts/index.js";
export type { PromptMode, PromptContext } from "./prompts/index.js";

export { analyzeCode, scoreAssignmentCode, generateLearningInsights } from "./analysis/index.js";
export type { CodeQualityReport, CodeMetrics, CodeIssue, AssignmentScore, LearningInsight } from "./analysis/index.js";

export {
  updateSkillScore,
  computeWeakAndStrongTopics,
  computeCompetencyScore,
  calculateLearningVelocity,
  detectRiskLevel,
  generateAdaptiveRecommendations,
  forecastPerformance,
  SKILL_TAXONOMY,
} from "./learning/adaptive.js";
export type {
  LearningProfile,
  SkillAssessmentEvent,
  LearningRecommendation,
  PerformanceForecast,
  RiskInput,
} from "./learning/adaptive.js";

export {
  computeStudentEngagementScore,
  computePerformanceScore,
  computeCohortAnalytics,
  computeCourseEffectiveness,
  computeAIUsageAnalytics,
} from "./analytics/index.js";
export type {
  StudentAnalyticsSummary,
  CohortAnalytics,
  CourseEffectivenessReport,
  MentorAnalytics,
  AIUsageAnalytics,
} from "./analytics/index.js";

export {
  responseCache,
  knowledgeCache,
  makeResponseCacheKey,
  makeKnowledgeCacheKey,
  invalidateKnowledgeCache,
  invalidateResponseCacheForMode,
  getCacheStats,
} from "./cache/index.js";
export type { CacheEntry, CacheStats } from "./cache/index.js";

export {
  recordRequest,
  assessAbuse,
  scoreContentSafety,
  scrubPII,
  detectUsageAnomalies,
} from "./security/index.js";
export type {
  RequestRecord,
  AbuseAssessment,
  ContentSafetyResult,
  UsageAnomaly,
} from "./security/index.js";
