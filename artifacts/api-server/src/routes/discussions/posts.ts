/**
 * Discussion post routes
 *
 * GET    /discussions/:threadId/posts     — list posts for a thread (flat, oldest first)
 * POST   /discussions/:threadId/posts     — create a post
 * PATCH  /discussions/posts/:id           — edit post body (author only)
 * DELETE /discussions/posts/:id           — soft-delete post
 */
import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  discussionsTable,
  discussionPostsTable,
  communityMembersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";
import { isCommunityModOrAdmin } from "./helpers.js";

const router = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CreatePostBody = z.object({
  body: z.string().min(1),
  parentPostId: z.number().int().optional(),
});

const UpdatePostBody = z.object({
  body: z.string().min(1),
});

// ─── GET /discussions/:threadId/posts ─────────────────────────────────────────

router.get("/discussions/:threadId/posts", requireAuth, async (req, res): Promise<void> => {
  const threadId = parseInt(String(req.params.threadId), 10);
  if (Number.isNaN(threadId)) {
    res.status(400).json({ error: "Invalid threadId" });
    return;
  }

  const [thread] = await db
    .select({ id: discussionsTable.id })
    .from(discussionsTable)
    .where(eq(discussionsTable.id, threadId))
    .limit(1);

  if (!thread) {
    res.status(404).json({ error: "Discussion not found" });
    return;
  }

  const rows = await db
    .select({
      post: discussionPostsTable,
      authorName: usersTable.name,
      authorAvatarUrl: usersTable.avatarUrl,
    })
    .from(discussionPostsTable)
    .leftJoin(usersTable, eq(discussionPostsTable.authorId, usersTable.id))
    .where(
      and(
        eq(discussionPostsTable.threadId, threadId),
        eq(discussionPostsTable.isDeleted, false),
      ),
    )
    .orderBy(asc(discussionPostsTable.createdAt));

  const result = rows.map((r) => ({
    ...r.post,
    authorName: r.authorName ?? "",
    authorAvatarUrl: r.authorAvatarUrl ?? null,
  }));

  res.json(result);
});

// ─── POST /discussions/:threadId/posts ────────────────────────────────────────

router.post("/discussions/:threadId/posts", requireAuth, async (req, res): Promise<void> => {
  const threadId = parseInt(String(req.params.threadId), 10);
  if (Number.isNaN(threadId)) {
    res.status(400).json({ error: "Invalid threadId" });
    return;
  }

  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [thread] = await db
    .select()
    .from(discussionsTable)
    .where(eq(discussionsTable.id, threadId))
    .limit(1);

  if (!thread) {
    res.status(404).json({ error: "Discussion not found" });
    return;
  }

  const user = req.user!;
  const isMod = await isCommunityModOrAdmin(user, thread.communityId);

  // Check if thread is locked — moderators/admins can still post
  if (thread.isLocked && !isMod) {
    res.status(403).json({ error: "This discussion is locked. No new replies are allowed." });
    return;
  }

  // Check community membership
  const [membership] = await db
    .select()
    .from(communityMembersTable)
    .where(
      and(
        eq(communityMembersTable.userId, user.id),
        eq(communityMembersTable.communityId, thread.communityId),
      ),
    )
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "You must join this community before posting. Please join first." });
    return;
  }

  if (membership.isSuspended) {
    res.status(403).json({ error: "Your membership in this community is suspended." });
    return;
  }

  const [post] = await db
    .insert(discussionPostsTable)
    .values({
      threadId,
      authorId: user.id,
      body: parsed.data.body,
      parentPostId: parsed.data.parentPostId ?? null,
    })
    .returning();

  res.status(201).json(post);
});

// ─── PATCH /discussions/posts/:id ─────────────────────────────────────────────

router.patch("/discussions/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(discussionPostsTable)
    .where(eq(discussionPostsTable.id, id))
    .limit(1);

  if (!existing || existing.isDeleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (existing.authorId !== req.user!.id) {
    res.status(403).json({ error: "Only the author can edit this post" });
    return;
  }

  const [updated] = await db
    .update(discussionPostsTable)
    .set({ body: parsed.data.body, updatedAt: new Date() })
    .where(eq(discussionPostsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── DELETE /discussions/posts/:id ────────────────────────────────────────────

router.delete("/discussions/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(discussionPostsTable)
    .where(eq(discussionPostsTable.id, id))
    .limit(1);

  if (!existing || existing.isDeleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  // Need the thread to check community
  const [thread] = await db
    .select()
    .from(discussionsTable)
    .where(eq(discussionsTable.id, existing.threadId))
    .limit(1);

  const user = req.user!;
  const isAuthor = existing.authorId === user.id;
  const isMod = thread ? await isCommunityModOrAdmin(user, thread.communityId) : false;

  if (!isAuthor && !isMod) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(discussionPostsTable)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(discussionPostsTable.id, id));

  res.sendStatus(204);
});

export default router;
