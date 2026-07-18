/**
 * Discussion thread routes
 *
 * GET    /discussions              — list threads (paginated, filtered)
 * POST   /discussions              — create thread
 * GET    /discussions/:id          — get one thread (increments viewCount)
 * PATCH  /discussions/:id          — edit thread (author or mod/admin)
 * DELETE /discussions/:id          — delete thread (author, mod/admin, platform admin)
 */
import { Router } from "express";
import { eq, and, desc, ilike, or, sql, count } from "drizzle-orm";
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

const CreateThreadBody = z.object({
  title: z.string().min(3),
  body: z.string().min(1),
  category: z.enum(["course", "lesson", "assignment", "project", "ai", "general", "qna"]).optional().default("general"),
  communityId: z.number().int(),
  courseId: z.number().int().optional(),
  lessonId: z.number().int().optional(),
  assignmentId: z.number().int().optional(),
  challengeId: z.number().int().optional(),
  teamId: z.number().int().optional(),
  isQuestion: z.boolean().optional().default(false),
});

const UpdateThreadBody = z.object({
  title: z.string().min(3).optional(),
  body: z.string().min(1).optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isResolved: z.boolean().optional(),
  acceptedPostId: z.number().int().optional(),
});

// ─── GET /discussions ─────────────────────────────────────────────────────────

router.get("/discussions", requireAuth, async (req, res): Promise<void> => {
  const communityId = parseInt(String(req.query.communityId), 10);
  if (Number.isNaN(communityId)) {
    res.status(400).json({ error: "communityId is required and must be an integer" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

  const conditions: ReturnType<typeof eq>[] = [eq(discussionsTable.communityId, communityId)];

  if (req.query.category) {
    conditions.push(eq(discussionsTable.category, req.query.category as any));
  }
  if (req.query.courseId) {
    conditions.push(eq(discussionsTable.courseId, parseInt(String(req.query.courseId), 10)));
  }
  if (req.query.lessonId) {
    conditions.push(eq(discussionsTable.lessonId, parseInt(String(req.query.lessonId), 10)));
  }
  if (req.query.assignmentId) {
    conditions.push(eq(discussionsTable.assignmentId, parseInt(String(req.query.assignmentId), 10)));
  }
  if (req.query.challengeId) {
    conditions.push(eq(discussionsTable.challengeId, parseInt(String(req.query.challengeId), 10)));
  }
  if (req.query.teamId) {
    conditions.push(eq(discussionsTable.teamId, parseInt(String(req.query.teamId), 10)));
  }
  if (req.query.isQuestion !== undefined) {
    conditions.push(eq(discussionsTable.isQuestion, req.query.isQuestion === "true"));
  }
  if (req.query.isResolved !== undefined) {
    conditions.push(eq(discussionsTable.isResolved, req.query.isResolved === "true"));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  let baseQuery = db
    .select({
      thread: discussionsTable,
      authorName: usersTable.name,
      authorAvatarUrl: usersTable.avatarUrl,
      postCount: sql<number>`cast(count(case when ${discussionPostsTable.isDeleted} = false then 1 end) as int)`,
    })
    .from(discussionsTable)
    .leftJoin(usersTable, eq(discussionsTable.authorId, usersTable.id))
    .leftJoin(discussionPostsTable, eq(discussionPostsTable.threadId, discussionsTable.id))
    .where(whereClause as any)
    .groupBy(discussionsTable.id, usersTable.name, usersTable.avatarUrl)
    .orderBy(desc(discussionsTable.isPinned), desc(discussionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  if (req.query.search) {
    const term = `%${String(req.query.search)}%`;
    const searchCondition = or(
      ilike(discussionsTable.title, term),
      ilike(discussionsTable.body, term),
    );
    baseQuery = db
      .select({
        thread: discussionsTable,
        authorName: usersTable.name,
        authorAvatarUrl: usersTable.avatarUrl,
        postCount: sql<number>`cast(count(case when ${discussionPostsTable.isDeleted} = false then 1 end) as int)`,
      })
      .from(discussionsTable)
      .leftJoin(usersTable, eq(discussionsTable.authorId, usersTable.id))
      .leftJoin(discussionPostsTable, eq(discussionPostsTable.threadId, discussionsTable.id))
      .where(and(whereClause as any, searchCondition))
      .groupBy(discussionsTable.id, usersTable.name, usersTable.avatarUrl)
      .orderBy(desc(discussionsTable.isPinned), desc(discussionsTable.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const rows = await baseQuery;
  const result = rows.map((r) => ({
    ...r.thread,
    authorName: r.authorName ?? "",
    authorAvatarUrl: r.authorAvatarUrl ?? null,
    postCount: r.postCount ?? 0,
  }));

  res.json(result);
});

// ─── POST /discussions ────────────────────────────────────────────────────────

router.post("/discussions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateThreadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const { communityId } = parsed.data;

  // Check community membership
  const [membership] = await db
    .select()
    .from(communityMembersTable)
    .where(
      and(
        eq(communityMembersTable.userId, userId),
        eq(communityMembersTable.communityId, communityId),
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

  const [thread] = await db
    .insert(discussionsTable)
    .values({ ...parsed.data, authorId: userId })
    .returning();

  res.status(201).json(thread);
});

// ─── GET /discussions/:id ─────────────────────────────────────────────────────

router.get("/discussions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({
      thread: discussionsTable,
      authorName: usersTable.name,
      authorAvatarUrl: usersTable.avatarUrl,
    })
    .from(discussionsTable)
    .leftJoin(usersTable, eq(discussionsTable.authorId, usersTable.id))
    .where(eq(discussionsTable.id, id))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "Discussion not found" });
    return;
  }

  const { thread, authorName, authorAvatarUrl } = rows[0];

  // Fire-and-forget view count increment
  db.update(discussionsTable)
    .set({ viewCount: sql`${discussionsTable.viewCount} + 1` })
    .where(eq(discussionsTable.id, id))
    .execute()
    .catch(() => { /* ignore */ });

  res.json({ ...thread, authorName: authorName ?? "", authorAvatarUrl: authorAvatarUrl ?? null });
});

// ─── PATCH /discussions/:id ───────────────────────────────────────────────────

router.patch("/discussions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateThreadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(discussionsTable)
    .where(eq(discussionsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Discussion not found" });
    return;
  }

  const user = req.user!;
  const isAuthor = existing.authorId === user.id;
  const isMod = await isCommunityModOrAdmin(user, existing.communityId);

  if (!isAuthor && !isMod) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Build the update — author can only edit title/body, mod/admin can also set moderation fields
  const { title, body, isPinned, isLocked, isResolved, acceptedPostId } = parsed.data;
  const updates: Partial<typeof existing> = {};

  if (isAuthor || isMod) {
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
  }
  if (isMod) {
    if (isPinned !== undefined) updates.isPinned = isPinned;
    if (isLocked !== undefined) updates.isLocked = isLocked;
    if (isResolved !== undefined) updates.isResolved = isResolved;
    if (acceptedPostId !== undefined) updates.acceptedPostId = acceptedPostId;
  }

  if (Object.keys(updates).length === 0) {
    res.json(existing);
    return;
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(discussionsTable)
    .set(updates)
    .where(eq(discussionsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── DELETE /discussions/:id ──────────────────────────────────────────────────

router.delete("/discussions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(discussionsTable)
    .where(eq(discussionsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Discussion not found" });
    return;
  }

  const user = req.user!;
  const isAuthor = existing.authorId === user.id;
  const isMod = await isCommunityModOrAdmin(user, existing.communityId);

  if (!isAuthor && !isMod) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(discussionsTable).where(eq(discussionsTable.id, id));
  res.sendStatus(204);
});

export default router;
