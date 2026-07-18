/**
 * Discussion reactions
 *
 * POST   /discussions/reactions         — react to thread or post
 * DELETE /discussions/reactions/:id     — remove own reaction
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, discussionReactionsTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

const CreateReactionBody = z.object({
  threadId: z.number().int().optional(),
  postId: z.number().int().optional(),
  emoji: z.string().min(1).max(10).default("👍"),
});

router.post("/discussions/reactions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { threadId, postId, emoji } = parsed.data;

  if (!threadId && !postId) {
    res.status(400).json({ error: "Provide either threadId or postId" });
    return;
  }
  if (threadId && postId) {
    res.status(400).json({ error: "Provide only one of threadId or postId" });
    return;
  }

  const userId = req.user!.id;

  const [reaction] = await db
    .insert(discussionReactionsTable)
    .values({ threadId: threadId ?? null, postId: postId ?? null, userId, emoji })
    .onConflictDoNothing()
    .returning();

  // If already reacted with same emoji, fetch and return existing
  if (!reaction) {
    const conditions = threadId
      ? and(eq(discussionReactionsTable.threadId, threadId), eq(discussionReactionsTable.userId, userId), eq(discussionReactionsTable.emoji, emoji))
      : and(eq(discussionReactionsTable.postId, postId!), eq(discussionReactionsTable.userId, userId), eq(discussionReactionsTable.emoji, emoji));

    const [existing] = await db
      .select()
      .from(discussionReactionsTable)
      .where(conditions)
      .limit(1);

    res.json(existing);
    return;
  }

  res.status(201).json(reaction);
});

router.delete("/discussions/reactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [reaction] = await db
    .select()
    .from(discussionReactionsTable)
    .where(eq(discussionReactionsTable.id, id))
    .limit(1);

  if (!reaction) {
    res.status(404).json({ error: "Reaction not found" });
    return;
  }

  const user = req.user!;
  if (reaction.userId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(discussionReactionsTable).where(eq(discussionReactionsTable.id, id));
  res.sendStatus(204);
});

export default router;
