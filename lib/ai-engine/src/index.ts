// AI Engine — public API
export { inferenceEngine, createInferenceEngine } from "./inference/index.js";
export type { ChatMessage, InferenceOptions, InferenceResult, StreamChunk } from "./inference/index.js";

export { indexDocument, deleteDocumentChunks, getKnowledgeStats, searchKnowledge } from "./knowledge/index.js";
export type { KnowledgeDocument, KnowledgeSourceType } from "./knowledge/index.js";

export { renderPrompt, sanitizeInput, truncateContext, BUILT_IN_PROMPTS } from "./prompts/index.js";
export type { PromptMode, PromptContext } from "./prompts/index.js";

export { analyzeCode, scoreAssignmentCode, generateLearningInsights } from "./analysis/index.js";
export type { CodeQualityReport, CodeMetrics, CodeIssue, AssignmentScore, LearningInsight } from "./analysis/index.js";
