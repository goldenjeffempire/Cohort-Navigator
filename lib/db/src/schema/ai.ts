/**
 * AI Platform Database Schema
 *
 * Tables:
 *  - ai_conversations      — chat sessions (per user, per context)
 *  - ai_messages           — individual chat messages
 *  - ai_knowledge_chunks   — RAG document chunks
 *  - ai_models             — model registry
 *  - ai_prompt_templates   — managed system prompts
 *  - ai_audit_logs         — security / usage audit
 *  - ai_feedback           — user feedback on AI responses
 *  - ai_usage_metrics      — daily aggregated usage stats
 */
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  real,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const aiConversationModeEnum = pgEnum("ai_conversation_mode", [
  "tutor",        // Learning assistant
  "code",         // Code assistant
  "assignment",   // Assignment help
  "interview",    // Interview practice
  "career",       // Career guidance
  "quiz",         // Quiz / practice questions
  "review",       // Project / code review
  "general",      // General chat
]);

export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
  "system",
]);

export const aiModelStatusEnum = pgEnum("ai_model_status", [
  "active",
  "inactive",
  "deprecated",
  "testing",
]);

export const aiKnowledgeSourceEnum = pgEnum("ai_knowledge_source", [
  "lesson",
  "course",
  "documentation",
  "challenge",
  "faq",
  "manual",
]);

export const aiAuditEventEnum = pgEnum("ai_audit_event", [
  "inference_request",
  "inference_response",
  "knowledge_search",
  "content_flagged",
  "rate_limit_hit",
  "prompt_injection_detected",
  "model_switch",
  "feedback_submitted",
]);

// ─── Conversations ────────────────────────────────────────────────────────────

export const aiConversationsTable = pgTable("ai_conversations", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mode:      aiConversationModeEnum("mode").notNull().default("tutor"),
  title:     text("title").notNull().default("New conversation"),
  // Optional context links
  courseId:  integer("course_id"),
  lessonId:  integer("lesson_id"),
  challengeId: integer("challenge_id"),
  assignmentId: integer("assignment_id"),
  // Metadata
  metadata:  jsonb("metadata").$type<Record<string, unknown>>(),
  archived:  boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Messages ─────────────────────────────────────────────────────────────────

export const aiMessagesTable = pgTable("ai_messages", {
  id:             serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => aiConversationsTable.id, { onDelete: "cascade" }),
  role:           aiMessageRoleEnum("role").notNull(),
  content:        text("content").notNull(),
  // Retrieval context used (for RAG transparency)
  retrievedChunks: jsonb("retrieved_chunks").$type<number[]>(),
  // Token counts for cost/usage tracking
  inputTokens:    integer("input_tokens"),
  outputTokens:   integer("output_tokens"),
  // Model that served this message
  modelId:        integer("model_id"),
  latencyMs:      integer("latency_ms"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  convIdx: index("ai_messages_conv_idx").on(t.conversationId),
}));

// ─── Knowledge Base Chunks ────────────────────────────────────────────────────

export const aiKnowledgeChunksTable = pgTable("ai_knowledge_chunks", {
  id:          serial("id").primaryKey(),
  sourceType:  aiKnowledgeSourceEnum("source_type").notNull(),
  sourceId:    integer("source_id").notNull(),   // ID in the source table
  title:       text("title").notNull(),
  content:     text("content").notNull(),
  // TF-IDF representation stored as serialised JSON (term -> weight)
  tfidfVector: jsonb("tfidf_vector").$type<Record<string, number>>(),
  // Dense local embedding (self-hosted feature-hashing vector, see
  // lib/ai-engine/src/knowledge/embeddings.ts) used for semantic / vector
  // search, combined with BM25 for hybrid retrieval.
  embedding:   jsonb("embedding").$type<number[]>(),
  // Metadata for filtering
  tags:        text("tags"),                     // comma-separated
  language:    text("language"),                 // programming language if code chunk
  chunkIndex:  integer("chunk_index").notNull().default(0),
  totalChunks: integer("total_chunks").notNull().default(1),
  // Content hash for dedup / staleness detection
  contentHash: text("content_hash").notNull(),
  indexed:     boolean("indexed").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  sourceIdx: index("ai_knowledge_source_idx").on(t.sourceType, t.sourceId),
  hashIdx:   index("ai_knowledge_hash_idx").on(t.contentHash),
}));

// ─── Model Registry ───────────────────────────────────────────────────────────

export const aiModelsTable = pgTable("ai_models", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull().unique(),
  displayName:  text("display_name").notNull(),
  provider:     text("provider").notNull().default("local"),   // local | ollama | openai-compatible
  modelId:      text("model_id").notNull(),                    // e.g. "llama3.2:3b"
  endpoint:     text("endpoint"),                              // override URL
  capabilities: text("capabilities"),                         // comma-separated: chat,code,analysis
  contextWindow: integer("context_window").notNull().default(4096),
  maxTokens:    integer("max_tokens").notNull().default(2048),
  status:       aiModelStatusEnum("status").notNull().default("active"),
  isDefault:    boolean("is_default").notNull().default(false),
  // MLOps: bumped whenever the model's weights/config are swapped so eval
  // history (ai_model_evaluations) can be compared across versions.
  version:      integer("version").notNull().default(1),
  config:       jsonb("config").$type<Record<string, unknown>>(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

// ─── Model Evaluations (MLOps) ─────────────────────────────────────────────────
//
// Stores the results of running the fixed evaluation suite
// (lib/ai-engine/src/evaluation/index.ts) against a specific model/version.
// Lets admins compare quality/latency across model swaps before promoting a
// new model to default (a lightweight continuous-evaluation gate).

export const aiModelEvaluationsTable = pgTable("ai_model_evaluations", {
  id:            serial("id").primaryKey(),
  modelId:       integer("model_id").references(() => aiModelsTable.id, { onDelete: "cascade" }),
  modelVersion:  integer("model_version").notNull().default(1),
  suiteName:     text("suite_name").notNull().default("default"),
  casesRun:      integer("cases_run").notNull(),
  casesPassed:   integer("cases_passed").notNull(),
  avgLatencyMs:  real("avg_latency_ms").notNull(),
  avgOutputTokens: real("avg_output_tokens").notNull(),
  score:         real("score").notNull(),          // 0-100 composite
  details:       jsonb("details").$type<Array<{ name: string; passed: boolean; latencyMs: number; note?: string }>>(),
  triggeredBy:   integer("triggered_by").references(() => usersTable.id),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

// ─── Prompt Templates ─────────────────────────────────────────────────────────

export const aiPromptTemplatesTable = pgTable("ai_prompt_templates", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull().unique(),
  mode:        aiConversationModeEnum("mode").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  // Handlebars-style variables used in the template: ["course", "lesson", ...]
  variables:   jsonb("variables").$type<string[]>(),
  isActive:    boolean("is_active").notNull().default(true),
  version:     integer("version").notNull().default(1),
  createdBy:   integer("created_by").references(() => usersTable.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const aiAuditLogsTable = pgTable("ai_audit_logs", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").references(() => usersTable.id),
  event:         aiAuditEventEnum("event").notNull(),
  conversationId: integer("conversation_id"),
  modelId:       integer("model_id"),
  // Sanitised (no PII) request summary
  requestSummary: text("request_summary"),
  responseStatus: text("response_status"),  // ok | blocked | error
  flagReason:    text("flag_reason"),
  ipAddress:     text("ip_address"),
  userAgent:     text("user_agent"),
  metadata:      jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx:  index("ai_audit_user_idx").on(t.userId),
  eventIdx: index("ai_audit_event_idx").on(t.event),
}));

// ─── Feedback ─────────────────────────────────────────────────────────────────

export const aiFeedbackTable = pgTable("ai_feedback", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  messageId: integer("message_id").notNull().references(() => aiMessagesTable.id, { onDelete: "cascade" }),
  rating:    integer("rating").notNull(),   // 1-5
  helpful:   boolean("helpful"),
  comment:   text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Usage Metrics ────────────────────────────────────────────────────────────

export const aiUsageMetricsTable = pgTable("ai_usage_metrics", {
  id:              serial("id").primaryKey(),
  date:            text("date").notNull(),            // YYYY-MM-DD
  mode:            aiConversationModeEnum("mode").notNull(),
  totalRequests:   integer("total_requests").notNull().default(0),
  totalTokensIn:   integer("total_tokens_in").notNull().default(0),
  totalTokensOut:  integer("total_tokens_out").notNull().default(0),
  avgLatencyMs:    real("avg_latency_ms"),
  errorCount:      integer("error_count").notNull().default(0),
  flaggedCount:    integer("flagged_count").notNull().default(0),
  uniqueUsers:     integer("unique_users").notNull().default(0),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});
