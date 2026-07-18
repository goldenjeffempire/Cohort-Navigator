/**
 * Conversation management (DMs, group chats, cohort rooms, team rooms)
 *
 * GET    /conversations                          — list my conversations
 * POST   /conversations                          — create DM or group
 * GET    /conversations/:id                      — detail + participants
 * PATCH  /conversations/:id                      — update title
 * POST   /conversations/:id/participants         — add participant
 * DELETE /conversations/:id/participants/:userId — remove / self-leave
 */
import { Router } from "express";
import { eq, and, desc, sql, max, count } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  messageReadsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// ─── GET /conversations ───────────────────────────────────────────────────────

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  // Get all conversation IDs for this user
  const participantRows = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));

  if (participantRows.length === 0) {
    res.json([]);
    return;
  }

  const conversationIds = participantRows.map((r) => r.conversationId);

  // Fetch conversations with latest message and unread count
  const conversations = await db
    .select({
      id: conversationsTable.id,
      kind: conversationsTable.kind,
      title: conversationsTable.title,
      cohortId: conversationsTable.cohortId,
      teamId: conversationsTable.teamId,
      createdById: conversationsTable.createdById,
      createdAt: conversationsTable.createdAt,
    })
    .from(conversationsTable)
    .where(
      sql`${conversationsTable.id} = ANY(ARRAY[${sql.join(conversationIds.map((id) => sql`${id}`), sql`, `)}]::int[])`,
    )
    .orderBy(desc(conversationsTable.createdAt));

  // Enrich with latest message and participant count
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const [latestMsg] = await db
        .select({
          id: messagesTable.id,
          body: messagesTable.body,
          senderId: messagesTable.senderId,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conv.id),
            eq(messagesTable.isDeleted, false),
          ),
        )
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      // Unread count
      const [readRow] = await db
        .select({ lastReadMessageId: messageReadsTable.lastReadMessageId })
        .from(messageReadsTable)
        .where(
          and(
            eq(messageReadsTable.conversationId, conv.id),
            eq(messageReadsTable.userId, userId),
          ),
        )
        .limit(1);

      const [{ totalMessages }] = await db
        .select({ totalMessages: count(messagesTable.id) })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conv.id),
            eq(messagesTable.isDeleted, false),
            readRow?.lastReadMessageId
              ? sql`${messagesTable.id} > ${readRow.lastReadMessageId}`
              : sql`TRUE`,
          ),
        );

      const [{ participantCount }] = await db
        .select({ participantCount: count(conversationParticipantsTable.id) })
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.conversationId, conv.id));

      return {
        ...conv,
        latestMessage: latestMsg ?? null,
        unreadCount: readRow?.lastReadMessageId != null ? totalMessages : 0,
        participantCount,
      };
    }),
  );

  // Sort by latest message time
  enriched.sort((a, b) => {
    const at = a.latestMessage?.createdAt?.getTime() ?? a.createdAt.getTime();
    const bt = b.latestMessage?.createdAt?.getTime() ?? b.createdAt.getTime();
    return bt - at;
  });

  res.json(enriched);
});

// ─── POST /conversations ──────────────────────────────────────────────────────

const CreateConversationBody = z.object({
  kind: z.enum(["dm", "group"]),
  participantIds: z.array(z.number().int()).min(1),
  title: z.string().optional(),
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const { kind, participantIds, title } = parsed.data;

  // Ensure self is included
  const allParticipants = Array.from(new Set([userId, ...participantIds]));

  // For DMs — check if conversation already exists between exactly these 2 users
  if (kind === "dm" && allParticipants.length === 2) {
    const myConvs = await db
      .select({ conversationId: conversationParticipantsTable.conversationId })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.userId, userId));

    for (const { conversationId } of myConvs) {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(
          and(eq(conversationsTable.id, conversationId), eq(conversationsTable.kind, "dm")),
        )
        .limit(1);

      if (!conv) continue;

      const participants = await db
        .select({ userId: conversationParticipantsTable.userId })
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.conversationId, conversationId));

      const ids = participants.map((p) => p.userId).sort();
      const want = [...allParticipants].sort();
      if (ids.length === want.length && ids.every((id, i) => id === want[i])) {
        res.json(conv);
        return;
      }
    }
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({ kind, title: title ?? null, createdById: userId })
    .returning();

  await db.insert(conversationParticipantsTable).values(
    allParticipants.map((pid) => ({
      conversationId: conversation.id,
      userId: pid,
    })),
  );

  res.status(201).json(conversation);
});

// ─── GET /conversations/:id ───────────────────────────────────────────────────

router.get("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const user = req.user!;

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  if (user.role !== "admin") {
    const [p] = await db
      .select()
      .from(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, id),
          eq(conversationParticipantsTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!p) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const participants = await db
    .select({
      id: conversationParticipantsTable.id,
      userId: conversationParticipantsTable.userId,
      isMuted: conversationParticipantsTable.isMuted,
      joinedAt: conversationParticipantsTable.joinedAt,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(conversationParticipantsTable)
    .innerJoin(usersTable, eq(conversationParticipantsTable.userId, usersTable.id))
    .where(eq(conversationParticipantsTable.conversationId, id));

  res.json({ ...conv, participants });
});

// ─── PATCH /conversations/:id ─────────────────────────────────────────────────

router.patch("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { title } = req.body as { title?: string };

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const user = req.user!;
  if (conv.kind !== "group") {
    res.status(400).json({ error: "Can only update title on group conversations" }); return;
  }
  if (conv.createdById !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [updated] = await db
    .update(conversationsTable)
    .set({ title: title ?? conv.title })
    .where(eq(conversationsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── POST /conversations/:id/participants ─────────────────────────────────────

router.post("/conversations/:id/participants", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { userId: targetUserId } = req.body as { userId?: number };
  if (!targetUserId) { res.status(400).json({ error: "userId is required" }); return; }

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const user = req.user!;
  if (conv.createdById !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [p] = await db
    .insert(conversationParticipantsTable)
    .values({ conversationId: id, userId: targetUserId })
    .onConflictDoNothing()
    .returning();

  res.status(201).json(p ?? { conversationId: id, userId: targetUserId });
});

// ─── DELETE /conversations/:id/participants/:userId ───────────────────────────

router.delete(
  "/conversations/:id/participants/:userId",
  requireAuth,
  async (req, res): Promise<void> => {
    const convId = parseInt(String(req.params.id), 10);
    const targetUserId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(convId) || Number.isNaN(targetUserId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const user = req.user!;
    const isSelf = targetUserId === user.id;

    if (!isSelf && user.role !== "admin") {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, convId))
        .limit(1);
      if (!conv || conv.createdById !== user.id) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }

    await db
      .delete(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, convId),
          eq(conversationParticipantsTable.userId, targetUserId),
        ),
      );

    res.sendStatus(204);
  },
);

export default router;
