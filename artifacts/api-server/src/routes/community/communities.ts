/**
 * Community CRUD + membership routes
 *
 * GET    /communities
 * GET    /communities/:id
 * POST   /communities
 * PATCH  /communities/:id
 * POST   /communities/:id/join
 * POST   /communities/:id/leave
 * GET    /communities/:id/members
 * PATCH  /communities/:id/members/:userId
 */
import { Router } from "express";
import { eq, and, inArray, count, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  communitiesTable,
  communityMembersTable,
  communityAuditLogsTable,
  cohortEnrollmentsTable,
  mentorCohortsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── Helper: get caller's community membership ────────────────────────────────

async function getCallerMembership(communityId: number, userId: number) {
  const [m] = await db
    .select()
    .from(communityMembersTable)
    .where(
      and(
        eq(communityMembersTable.communityId, communityId),
        eq(communityMembersTable.userId, userId),
      ),
    );
  return m ?? null;
}

// ─── List communities visible to user ────────────────────────────────────────

router.get("/communities", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  // Build member-count subquery
  const memberCounts = db
    .select({
      communityId: communityMembersTable.communityId,
      memberCount: count(communityMembersTable.id).as("memberCount"),
    })
    .from(communityMembersTable)
    .groupBy(communityMembersTable.communityId)
    .as("mc");

  if (user.role === "admin") {
    // Admins see all
    const rows = await db
      .select({
        id: communitiesTable.id,
        kind: communitiesTable.kind,
        cohortId: communitiesTable.cohortId,
        name: communitiesTable.name,
        description: communitiesTable.description,
        guidelines: communitiesTable.guidelines,
        createdAt: communitiesTable.createdAt,
        memberCount: sql<number>`coalesce(${memberCounts.memberCount}, 0)`,
      })
      .from(communitiesTable)
      .leftJoin(memberCounts, eq(communitiesTable.id, memberCounts.communityId));
    res.json(rows);
    return;
  }

  // Gather cohort ids the user is enrolled in or mentors
  const enrolledRows = await db
    .select({ cohortId: cohortEnrollmentsTable.cohortId })
    .from(cohortEnrollmentsTable)
    .where(eq(cohortEnrollmentsTable.studentId, user.id));

  const mentoredRows = await db
    .select({ cohortId: mentorCohortsTable.cohortId })
    .from(mentorCohortsTable)
    .where(eq(mentorCohortsTable.mentorId, user.id));

  const cohortIds = [
    ...enrolledRows.map((r) => r.cohortId),
    ...mentoredRows.map((r) => r.cohortId),
  ];

  // Fetch global communities + cohort communities whose cohortId is in the list
  const allCommunities = await db
    .select({
      id: communitiesTable.id,
      kind: communitiesTable.kind,
      cohortId: communitiesTable.cohortId,
      name: communitiesTable.name,
      description: communitiesTable.description,
      guidelines: communitiesTable.guidelines,
      createdAt: communitiesTable.createdAt,
      memberCount: sql<number>`coalesce(${memberCounts.memberCount}, 0)`,
    })
    .from(communitiesTable)
    .leftJoin(memberCounts, eq(communitiesTable.id, memberCounts.communityId));

  const visible = allCommunities.filter(
    (c) =>
      c.kind === "global" ||
      (c.cohortId !== null && cohortIds.includes(c.cohortId)),
  );

  res.json(visible);
});

// ─── Get one community ────────────────────────────────────────────────────────

router.get("/communities/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [community] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, id));

  if (!community) {
    res.status(404).json({ error: "Community not found" });
    return;
  }

  const user = req.user!;

  if (user.role !== "admin") {
    // Check membership
    const membership = await getCallerMembership(id, user.id);
    if (!membership) {
      res.status(404).json({ error: "Community not found" });
      return;
    }
  }

  const [{ memberCount }] = await db
    .select({ memberCount: count(communityMembersTable.id) })
    .from(communityMembersTable)
    .where(eq(communityMembersTable.communityId, id));

  res.json({ ...community, memberCount });
});

// ─── Create community ─────────────────────────────────────────────────────────

const CreateCommunityBody = z.object({
  kind: z.enum(["global", "cohort"]),
  cohortId: z.number().int().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  guidelines: z.string().optional(),
});

router.post(
  "/communities",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const parsed = CreateCommunityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { kind, cohortId, name, description, guidelines } = parsed.data;

    if (kind === "cohort" && cohortId == null) {
      res.status(400).json({ error: "cohortId is required when kind is 'cohort'" });
      return;
    }

    try {
      const [community] = await db
        .insert(communitiesTable)
        .values({ kind, cohortId, name, description, guidelines })
        .returning();

      // Auto-create admin membership for creator
      await db
        .insert(communityMembersTable)
        .values({ communityId: community.id, userId: req.user!.id, role: "admin" });

      res.status(201).json(community);
    } catch (err: any) {
      // Unique constraint on cohortId
      if (err?.code === "23505") {
        res.status(409).json({ error: "A community for this cohort already exists" });
        return;
      }
      throw err;
    }
  },
);

// ─── Update community ─────────────────────────────────────────────────────────

const UpdateCommunityBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  guidelines: z.string().optional(),
});

router.patch(
  "/communities/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateCommunityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const user = req.user!;

    // Mentors must be a moderator/admin of the community
    if (user.role === "mentor") {
      const membership = await getCallerMembership(id, user.id);
      if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const [community] = await db
      .update(communitiesTable)
      .set(parsed.data)
      .where(eq(communitiesTable.id, id))
      .returning();

    if (!community) {
      res.status(404).json({ error: "Community not found" });
      return;
    }

    res.json(community);
  },
);

// ─── Join community ───────────────────────────────────────────────────────────

router.post("/communities/:id/join", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [community] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, id));

  if (!community) {
    res.status(404).json({ error: "Community not found" });
    return;
  }

  const userId = req.user!.id;

  // Idempotent: return existing membership if already a member
  const existing = await getCallerMembership(id, userId);
  if (existing) {
    res.json(existing);
    return;
  }

  const [membership] = await db
    .insert(communityMembersTable)
    .values({ communityId: id, userId, role: "member" })
    .returning();

  res.status(201).json(membership);
});

// ─── Leave community ──────────────────────────────────────────────────────────

router.post("/communities/:id/leave", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.user!.id;

  await db
    .delete(communityMembersTable)
    .where(
      and(
        eq(communityMembersTable.communityId, id),
        eq(communityMembersTable.userId, userId),
      ),
    );

  res.sendStatus(204);
});

// ─── List members ─────────────────────────────────────────────────────────────

router.get("/communities/:id/members", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

  const [community] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, id));

  if (!community) {
    res.status(404).json({ error: "Community not found" });
    return;
  }

  const members = await db
    .select({
      id: communityMembersTable.id,
      communityId: communityMembersTable.communityId,
      userId: communityMembersTable.userId,
      role: communityMembersTable.role,
      isSuspended: communityMembersTable.isSuspended,
      joinedAt: communityMembersTable.joinedAt,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(communityMembersTable)
    .innerJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
    .where(eq(communityMembersTable.communityId, id))
    .limit(limit)
    .offset(offset);

  res.json(members);
});

// ─── Update member role / suspension ─────────────────────────────────────────

const UpdateMemberBody = z.object({
  role: z.enum(["member", "moderator", "admin"]).optional(),
  isSuspended: z.boolean().optional(),
});

router.patch(
  "/communities/:id/members/:userId",
  requireAuth,
  async (req, res): Promise<void> => {
    const communityId = parseInt(String(req.params.id), 10);
    const targetUserId = parseInt(String(req.params.userId), 10);

    if (Number.isNaN(communityId) || Number.isNaN(targetUserId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (parsed.data.role === undefined && parsed.data.isSuspended === undefined) {
      res.status(400).json({ error: "Provide at least one of: role, isSuspended" });
      return;
    }

    const caller = req.user!;

    // Authorization: platform admin bypasses; mentor/moderator must be community mod/admin
    if (caller.role !== "admin") {
      const callerMembership = await getCallerMembership(communityId, caller.id);
      if (
        !callerMembership ||
        (callerMembership.role !== "moderator" && callerMembership.role !== "admin")
      ) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    // Fetch the target membership
    const [targetMembership] = await db
      .select()
      .from(communityMembersTable)
      .where(
        and(
          eq(communityMembersTable.communityId, communityId),
          eq(communityMembersTable.userId, targetUserId),
        ),
      );

    if (!targetMembership) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const [updated] = await db
      .update(communityMembersTable)
      .set(parsed.data)
      .where(eq(communityMembersTable.id, targetMembership.id))
      .returning();

    // Write audit log
    const roleChanged = parsed.data.role !== undefined && parsed.data.role !== targetMembership.role;
    const suspendedChanged =
      parsed.data.isSuspended !== undefined && parsed.data.isSuspended !== targetMembership.isSuspended;

    if (roleChanged) {
      await db.insert(communityAuditLogsTable).values({
        communityId,
        actorId: caller.id,
        event: "role_changed",
        targetType: "user",
        targetId: targetUserId,
        detail: `Role changed from ${targetMembership.role} to ${parsed.data.role}`,
      });
    }

    if (suspendedChanged) {
      const event = parsed.data.isSuspended ? "member_suspended" : "member_unsuspended";
      await db.insert(communityAuditLogsTable).values({
        communityId,
        actorId: caller.id,
        event,
        targetType: "user",
        targetId: targetUserId,
        detail: parsed.data.isSuspended
          ? `Member suspended`
          : `Member unsuspended`,
      });
    }

    res.json(updated);
  },
);

export default router;
