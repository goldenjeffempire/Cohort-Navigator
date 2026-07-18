/**
 * Messages within a conversation + SSE for real-time delivery
 *
 * GET    /conversations/:id/messages        — paginated history
 * POST   /conversations/:id/messages        — send message
 * DELETE /conversations/:id/messages/:msgId — soft-delete
 * GET    /conversations/:id/events          — SSE stream
 */
import { Router } from "express";
import { eq, and, lt, desc, asc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  messagesTable,
  conversationParticipantsTable,
  messageReadsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";
import type { Response } from "express";

const router = Router();

// Module-level SSE client registry: conversationId → Set<Response>
const sseClients = new Map<number, Set<Response>>();

async function assertParticipant(conversationId: number, userId: number, role: string): Promise<boolean> {
  if (role === "admin") return true;
  const [p] = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId),
      ),
    )
    .limit(1);
  return !!p;
}

// ─── GET /conversations/:id/messages ─────────────────────────────────────────

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(convId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const user = req.user!;
  if (!(await assertParticipant(convId, user.id, user.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const before = req.query.before ? parseInt(String(req.query.before), 10) : undefined;

  const conditions: ReturnType<typeof eq>[] = [
    eq(messagesTable.conversationId, convId),
    eq(messagesTable.isDeleted, false),
  ];
  if (before && !Number.isNaN(before)) {
    conditions.push(lt(messagesTable.id, before) as any);
  }

  const rows = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      senderId: messagesTable.senderId,
      body: messagesTable.body,
      attachmentObjectPath: messagesTable.attachmentObjectPath,
      isDeleted: messagesTable.isDeleted,
      createdAt: messagesTable.createdAt,
      senderName: usersTable.name,
      senderAvatarUrl: usersTable.avatarUrl,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(and(...conditions) as any)
    .orderBy(desc(messagesTable.id))
    .limit(limit);

  // Update read watermark
  if (rows.length > 0) {
    const maxId = rows[0].id; // desc order — first is newest
    await db
      .insert(messageReadsTable)
      .values({ conversationId: convId, userId: user.id, lastReadMessageId: maxId })
      .onConflictDoUpdate({
        target: [messageReadsTable.conversationId, messageReadsTable.userId],
        set: { lastReadMessageId: maxId, readAt: new Date() },
      });
  }

  // Return oldest-first
  res.json(rows.reverse());
});

// ─── POST /conversations/:id/messages ────────────────────────────────────────

const SendMessageBody = z.object({
  body: z.string().min(1),
  attachmentObjectPath: z.string().optional(),
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(convId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const user = req.user!;
  if (!(await assertParticipant(convId, user.id, user.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: convId,
      senderId: user.id,
      body: parsed.data.body,
      attachmentObjectPath: parsed.data.attachmentObjectPath ?? null,
    })
    .returning();

  // Enrich with sender info for broadcast
  const enriched = {
    ...message,
    senderName: user.name,
    senderAvatarUrl: user.avatarUrl ?? null,
  };

  // SSE broadcast to all connected clients in this conversation
  const clients = sseClients.get(convId);
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify({ type: "message", data: enriched })}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        // Client disconnected — will be cleaned up on close event
      }
    }
  }

  res.status(201).json(enriched);
});

// ─── DELETE /conversations/:id/messages/:messageId ────────────────────────────

router.delete(
  "/conversations/:id/messages/:messageId",
  requireAuth,
  async (req, res): Promise<void> => {
    const convId = parseInt(String(req.params.id), 10);
    const msgId = parseInt(String(req.params.messageId), 10);
    if (Number.isNaN(convId) || Number.isNaN(msgId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const [message] = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.id, msgId), eq(messagesTable.conversationId, convId)))
      .limit(1);

    if (!message) { res.status(404).json({ error: "Message not found" }); return; }

    const user = req.user!;
    if (message.senderId !== user.id && user.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const [updated] = await db
      .update(messagesTable)
      .set({ isDeleted: true })
      .where(eq(messagesTable.id, msgId))
      .returning();

    // Broadcast deletion event
    const clients = sseClients.get(convId);
    if (clients && clients.size > 0) {
      const payload = `data: ${JSON.stringify({ type: "deleted", data: { id: msgId } })}\n\n`;
      for (const client of clients) {
        try { client.write(payload); } catch { /* ignore */ }
      }
    }

    res.json(updated);
  },
);

// ─── GET /conversations/:id/events (SSE) ─────────────────────────────────────

router.get("/conversations/:id/events", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(convId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const user = req.user!;
  if (!(await assertParticipant(convId, user.id, user.role))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write("retry: 3000\n\n");

  if (!sseClients.has(convId)) sseClients.set(convId, new Set());
  sseClients.get(convId)!.add(res);

  // Keepalive ping every 20 seconds
  const interval = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(interval);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(interval);
    sseClients.get(convId)?.delete(res);
    if (sseClients.get(convId)?.size === 0) sseClients.delete(convId);
  });
});

export default router;
