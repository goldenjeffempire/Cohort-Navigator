/**
 * AI Administration routes (admin only)
 *
 * GET  /ai/admin/models              — list models in registry
 * POST /ai/admin/models              — register a model
 * PATCH /ai/admin/models/:id         — update model config
 * DELETE /ai/admin/models/:id        — remove model
 * POST /ai/admin/models/:id/activate — set as default
 *
 * GET  /ai/admin/prompts             — list prompt templates
 * POST /ai/admin/prompts             — create prompt template
 * PATCH /ai/admin/prompts/:id        — update prompt template
 *
 * GET  /ai/admin/audit               — audit log
 * GET  /ai/admin/metrics             — usage metrics
 * GET  /ai/admin/analytics           — platform AI analytics
 * GET  /ai/admin/feedback            — collected feedback
 *
 * GET  /ai/admin/status              — engine status (ping)
 */
import { Router } from "express";
import { eq, desc, count, avg, sum, gte } from "drizzle-orm";
import {
  db,
  aiModelsTable,
  aiPromptTemplatesTable,
  aiAuditLogsTable,
  aiUsageMetricsTable,
  aiFeedbackTable,
  aiConversationsTable,
  aiMessagesTable,
  aiModelEvaluationsTable,
} from "@workspace/db";
import { inferenceEngine } from "@workspace/ai-engine/inference";
import { runEvalSuite } from "@workspace/ai-engine/evaluation";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("admin")];

// ─── Engine status ────────────────────────────────────────────────────────────

router.get("/ai/admin/status", ...adminOnly, async (_req, res): Promise<void> => {
  const localOnline = await inferenceEngine.ping();
  const endpoint = process.env.AI_MODEL_ENDPOINT ?? null;
  const [modelCount] = await db.select({ count: count() }).from(aiModelsTable);
  const [convCount] = await db.select({ count: count() }).from(aiConversationsTable);
  const [msgCount] = await db.select({ count: count() }).from(aiMessagesTable);

  res.json({
    mode: localOnline ? "local_model" : "built_in_rag",
    localModelEndpoint: endpoint,
    localOnline,
    registry: { models: modelCount.count },
    usage: { conversations: convCount.count, messages: msgCount.count },
    version: "1.0.0",
  });
});

// ─── Models ───────────────────────────────────────────────────────────────────

router.get("/ai/admin/models", ...adminOnly, async (_req, res): Promise<void> => {
  res.json(await db.select().from(aiModelsTable).orderBy(aiModelsTable.createdAt));
});

router.post("/ai/admin/models", ...adminOnly, async (req, res): Promise<void> => {
  const { name, displayName, provider = "local", modelId, endpoint, capabilities, contextWindow = 4096, maxTokens = 2048, config } = req.body;
  if (!name || !modelId) { res.status(400).json({ error: "name and modelId required" }); return; }

  const [model] = await db.insert(aiModelsTable).values({
    name, displayName: displayName ?? name, provider, modelId, endpoint,
    capabilities, contextWindow, maxTokens, config,
  }).returning();
  res.status(201).json(model);
});

router.patch("/ai/admin/models/:id", ...adminOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const updates = req.body;
  delete updates.id; delete updates.createdAt;
  const [updated] = await db.update(aiModelsTable).set({ ...updates, updatedAt: new Date() }).where(eq(aiModelsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/ai/admin/models/:id", ...adminOnly, async (req, res): Promise<void> => {
  await db.delete(aiModelsTable).where(eq(aiModelsTable.id, parseInt(req.params.id)));
  res.status(204).end();
});

router.post("/ai/admin/models/:id/activate", ...adminOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.update(aiModelsTable).set({ isDefault: false }).where(eq(aiModelsTable.isDefault, true));
  const [model] = await db.update(aiModelsTable).set({ isDefault: true, status: "active" }).where(eq(aiModelsTable.id, id)).returning();
  if (!model) { res.status(404).json({ error: "Not found" }); return; }
  res.json(model);
});

// ─── MLOps: evaluation suite (continuous-evaluation gate) ────────────────────
//
// Runs the fixed evaluation prompt suite against whichever engine is
// currently active (self-hosted local model via AI_MODEL_ENDPOINT, or the
// built-in RAG fallback) and stores the result against the model registry
// entry so quality/latency can be compared across model swaps and prompt
// template changes before promoting a model to default.

router.post("/ai/admin/models/:id/evaluate", ...adminOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [model] = await db.select().from(aiModelsTable).where(eq(aiModelsTable.id, id));
  if (!model) { res.status(404).json({ error: "Not found" }); return; }

  const result = await runEvalSuite(inferenceEngine);

  const [saved] = await db.insert(aiModelEvaluationsTable).values({
    modelId: model.id,
    modelVersion: model.version,
    suiteName: result.suiteName,
    casesRun: result.casesRun,
    casesPassed: result.casesPassed,
    avgLatencyMs: result.avgLatencyMs,
    avgOutputTokens: result.avgOutputTokens,
    score: result.score,
    details: result.details,
    triggeredBy: req.user!.id,
  }).returning();

  res.status(201).json(saved);
});

router.get("/ai/admin/models/:id/evaluations", ...adminOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const evals = await db.select().from(aiModelEvaluationsTable)
    .where(eq(aiModelEvaluationsTable.modelId, id))
    .orderBy(desc(aiModelEvaluationsTable.createdAt))
    .limit(20);
  res.json(evals);
});

// ─── Prompt templates ─────────────────────────────────────────────────────────

router.get("/ai/admin/prompts", ...adminOnly, async (_req, res): Promise<void> => {
  res.json(await db.select().from(aiPromptTemplatesTable).orderBy(aiPromptTemplatesTable.mode));
});

router.post("/ai/admin/prompts", ...adminOnly, async (req, res): Promise<void> => {
  const { name, mode, description, systemPrompt, variables } = req.body;
  if (!name || !mode || !systemPrompt) { res.status(400).json({ error: "name, mode, systemPrompt required" }); return; }
  const [tmpl] = await db.insert(aiPromptTemplatesTable).values({
    name, mode, description, systemPrompt, variables, createdBy: req.user!.id,
  }).returning();
  res.status(201).json(tmpl);
});

router.patch("/ai/admin/prompts/:id", ...adminOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { systemPrompt, description, variables, isActive } = req.body;

  const [existing] = await db.select().from(aiPromptTemplatesTable).where(eq(aiPromptTemplatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(aiPromptTemplatesTable).set({
    systemPrompt: systemPrompt ?? existing.systemPrompt,
    description: description ?? existing.description,
    variables: variables ?? existing.variables,
    isActive: isActive ?? existing.isActive,
    version: existing.version + 1,
    updatedAt: new Date(),
  }).where(eq(aiPromptTemplatesTable.id, id)).returning();
  res.json(updated);
});

// ─── Audit log ────────────────────────────────────────────────────────────────

router.get("/ai/admin/audit", ...adminOnly, async (req, res): Promise<void> => {
  const { limit = "50", event } = req.query as Record<string, string>;
  const logs = await db.select().from(aiAuditLogsTable)
    .orderBy(desc(aiAuditLogsTable.createdAt))
    .limit(Math.min(parseInt(limit) || 50, 200));
  res.json(logs);
});

// ─── Usage metrics ────────────────────────────────────────────────────────────

router.get("/ai/admin/metrics", ...adminOnly, async (_req, res): Promise<void> => {
  const metrics = await db.select().from(aiUsageMetricsTable)
    .orderBy(desc(aiUsageMetricsTable.date))
    .limit(30);
  res.json(metrics);
});

// ─── Platform AI analytics ────────────────────────────────────────────────────

router.get("/ai/admin/analytics", ...adminOnly, async (_req, res): Promise<void> => {
  const [totalConvs] = await db.select({ count: count() }).from(aiConversationsTable);
  const [totalMsgs] = await db.select({ count: count() }).from(aiMessagesTable);
  const [flagged] = await db.select({ count: count() }).from(aiAuditLogsTable)
    .where(eq(aiAuditLogsTable.responseStatus, "blocked"));
  const [avgFeedback] = await db.select({ avg: avg(aiFeedbackTable.rating) }).from(aiFeedbackTable);

  // Conversations by mode
  const byMode = await db.select({
    mode: aiConversationsTable.mode,
    count: count(),
  }).from(aiConversationsTable).groupBy(aiConversationsTable.mode);

  // Recent feedback
  const recentFeedback = await db.select().from(aiFeedbackTable)
    .orderBy(desc(aiFeedbackTable.createdAt))
    .limit(10);

  res.json({
    totalConversations: totalConvs.count,
    totalMessages: totalMsgs.count,
    flaggedRequests: flagged.count,
    averageRating: avgFeedback.avg ? Number(avgFeedback.avg).toFixed(2) : null,
    conversationsByMode: Object.fromEntries(byMode.map((r) => [r.mode, r.count])),
    recentFeedback,
  });
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

router.get("/ai/admin/feedback", ...adminOnly, async (_req, res): Promise<void> => {
  const feedback = await db.select().from(aiFeedbackTable)
    .orderBy(desc(aiFeedbackTable.createdAt))
    .limit(100);
  res.json(feedback);
});

export default router;
