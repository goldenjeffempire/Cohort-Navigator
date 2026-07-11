/**
 * Leaderboard routes
 *
 * GET /communities/:id/leaderboard
 */
import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  communitiesTable,
  communityMembersTable,
  usersTable,
  discussionsTable,
  discussionPostsTable,
  userBadgesTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// ─── Community leaderboard ────────────────────────────────────────────────────

router.get(
  "/communities/:id/leaderboard",
  requireAuth,
  async (req, res): Promise<void> => {
    const communityId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(communityId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

    const [community] = await db
      .select()
      .from(communitiesTable)
      .where(eq(communitiesTable.id, communityId));

    if (!community) {
      res.status(404).json({ error: "Community not found" });
      return;
    }

    // Count discussion posts per user in threads belonging to this community
    const postCounts = db
      .select({
        userId: discussionPostsTable.authorId,
        postCount: sql<number>`count(${discussionPostsTable.id})::int`.as("postCount"),
      })
      .from(discussionPostsTable)
      .innerJoin(discussionsTable, eq(discussionPostsTable.threadId, discussionsTable.id))
      .where(eq(discussionsTable.communityId, communityId))
      .groupBy(discussionPostsTable.authorId)
      .as("pc");

    // Count badges per user
    const badgeCounts = db
      .select({
        userId: userBadgesTable.userId,
        badgeCount: sql<number>`count(${userBadgesTable.id})::int`.as("badgeCount"),
      })
      .from(userBadgesTable)
      .groupBy(userBadgesTable.userId)
      .as("bc");

    // Join members with post/badge counts, compute weighted score
    const rows = await db
      .select({
        userId: communityMembersTable.userId,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl,
        postCount: sql<number>`coalesce(${postCounts.postCount}, 0)`,
        badgeCount: sql<number>`coalesce(${badgeCounts.badgeCount}, 0)`,
        score: sql<number>`(coalesce(${postCounts.postCount}, 0) * 1 + coalesce(${badgeCounts.badgeCount}, 0) * 5)`,
      })
      .from(communityMembersTable)
      .innerJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
      .leftJoin(postCounts, eq(communityMembersTable.userId, postCounts.userId))
      .leftJoin(badgeCounts, eq(communityMembersTable.userId, badgeCounts.userId))
      .where(eq(communityMembersTable.communityId, communityId))
      .orderBy(sql`score desc`)
      .limit(limit);

    res.json(rows);
  },
);

export default router;
