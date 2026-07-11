/**
 * AI Chat routes — streaming learning assistant
 *
 * GET  /ai/conversations            — list user conversations
 * POST /ai/conversations            — create conversation
 * GET  /ai/conversations/:id        — get conversation + messages
 * DELETE /ai/conversations/:id      — delete conversation
 * GET  /ai/conversations/:id/messages — list messages
 * POST /ai/conversations/:id/messages — send message (SSE stream)
 * POST /ai/messages/:id/feedback    — submit feedback on a message
 */
import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  aiConversationsTable,
  aiMessagesTable,
  aiFeedbackTable,
  aiAuditLogsTable,
} from "@workspace/db";
import { inferenceEngine } from "@workspace/ai-engine/inference";
import { renderPrompt, sanitizeInput } from "@workspace/ai-engine/prompts";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// ─── List conversations ───────────────────────────────────────────────────────

router.get("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const convs = await db
    .select()
    .from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.userId, userId), eq(aiConversationsTable.archived, false)))
    .orderBy(desc(aiConversationsTable.updatedAt))
    .limit(50);
  res.json(convs);
});

// ─── Create conversation ──────────────────────────────────────────────────────

router.post("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { mode = "tutor", title = "New conversation", courseId, lessonId, challengeId, assignmentId, metadata } = req.body;

  const [conv] = await db.insert(aiConversationsTable).values({
    userId,
    mode,
    title,
    courseId,
    lessonId,
    challengeId,
    assignmentId,
    metadata,
  }).returning();

  res.status(201).json(conv);
});

// ─── Get conversation with messages ──────────────────────────────────────────

router.get("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [conv] = await db.select().from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.userId, userId)));

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const messages = await db.select().from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversationId, id))
    .orderBy(aiMessagesTable.createdAt);

  res.json({ ...conv, messages });
});

// ─── Delete conversation ──────────────────────────────────────────────────────

router.delete("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [conv] = await db.select().from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.userId, userId)));

  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(aiConversationsTable).where(eq(aiConversationsTable.id, id));
  res.status(204).end();
});

// ─── List messages ────────────────────────────────────────────────────────────

router.get("/ai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [conv] = await db.select({ id: aiConversationsTable.id })
    .from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.userId, userId)));

  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  const messages = await db.select().from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversationId, id))
    .orderBy(aiMessagesTable.createdAt);

  res.json(messages);
});

// ─── Send message (SSE stream) ────────────────────────────────────────────────

router.post("/ai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const convId = parseInt(req.params.id);
  const { content, context: msgCtx = {} } = req.body;

  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  // Safety check
  const safety = sanitizeInput(content);
  if (!safety.safe) {
    await db.insert(aiAuditLogsTable).values({
      userId,
      event: safety.reason === "prompt_injection" ? "prompt_injection_detected" : "content_flagged",
      conversationId: convId,
      requestSummary: content.slice(0, 100),
      responseStatus: "blocked",
      flagReason: safety.reason,
    });
    res.status(400).json({ error: "Message blocked by content filter", reason: safety.reason });
    return;
  }

  // Verify conversation ownership
  const [conv] = await db.select().from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.id, convId), eq(aiConversationsTable.userId, userId)));

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Load history (last 10 turns)
  const history = await db.select()
    .from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversationId, convId))
    .orderBy(desc(aiMessagesTable.createdAt))
    .limit(10);
  history.reverse();

  // Save user message
  const [userMsg] = await db.insert(aiMessagesTable).values({
    conversationId: convId,
    role: "user",
    content,
  }).returning();

  // Build messages for inference
  const systemPrompt = renderPrompt(conv.mode as any, {
    userName: req.user!.name,
    userRole: req.user!.role,
    ...msgCtx,
  });

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content },
  ];

  // Stream response via SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullContent = "";
  let inferenceResult: any = null;
  const start = Date.now();

  try {
    for await (const chunk of inferenceEngine.stream(chatMessages)) {
      if (!chunk.done) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      } else {
        inferenceResult = chunk.result;
      }
    }

    // Save assistant message
    const [assistMsg] = await db.insert(aiMessagesTable).values({
      conversationId: convId,
      role: "assistant",
      content: fullContent,
      inputTokens: inferenceResult?.inputTokens,
      outputTokens: inferenceResult?.outputTokens,
      latencyMs: Date.now() - start,
    }).returning();

    // Update conversation timestamp
    await db.update(aiConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversationsTable.id, convId));

    // Audit log
    await db.insert(aiAuditLogsTable).values({
      userId,
      event: "inference_response",
      conversationId: convId,
      requestSummary: content.slice(0, 100),
      responseStatus: "ok",
      metadata: { modelUsed: inferenceResult?.modelUsed, latencyMs: Date.now() - start },
    });

    res.write(`data: ${JSON.stringify({ done: true, messageId: assistMsg.id })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Inference failed", done: true })}\n\n`);
  }

  res.end();
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

router.post("/ai/messages/:id/feedback", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const messageId = parseInt(req.params.id);
  const { rating, helpful, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1-5" });
    return;
  }

  const [fb] = await db.insert(aiFeedbackTable).values({
    userId,
    messageId,
    rating,
    helpful,
    comment,
  }).returning();

  res.status(201).json(fb);
});

export default router;
