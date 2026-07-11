import { Router } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  teamsTable,
  teamMembersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── GET /teams ───────────────────────────────────────────────────────────────

router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const { cohortId, kind, mine } = req.query;
  const userId = req.user!.id;

  const conditions: ReturnType<typeof eq>[] = [];

  if (cohortId) {
    const cid = parseInt(String(cohortId), 10);
    if (Number.isNaN(cid)) { res.status(400).json({ error: "Invalid cohortId" }); return; }
    conditions.push(eq(teamsTable.cohortId, cid));
  }
  if (kind === "project" || kind === "study_group") {
    conditions.push(eq(teamsTable.kind, kind));
  }

  // Build sub-query for memberCount
  const rows = await db
    .select({
      id: teamsTable.id,
      cohortId: teamsTable.cohortId,
      kind: teamsTable.kind,
      name: teamsTable.name,
      description: teamsTable.description,
      createdById: teamsTable.createdById,
      createdAt: teamsTable.createdAt,
      memberCount: sql<number>`(select count(*) from team_members where team_members.team_id = ${teamsTable.id})::int`,
    })
    .from(teamsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (mine === "true") {
    // Filter to only teams the caller is a member of
    const memberTeamIds = await db
      .select({ teamId: teamMembersTable.teamId })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, userId));
    const ids = new Set(memberTeamIds.map((r) => r.teamId));
    res.json(rows.filter((r) => ids.has(r.id)));
    return;
  }

  res.json(rows);
});

// ─── POST /teams ──────────────────────────────────────────────────────────────

const CreateTeamSchema = z.object({
  cohortId: z.number().int(),
  kind: z.enum(["project", "study_group"]).optional().default("project"),
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post("/teams", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTeamSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.user!.id;
  const { cohortId, kind, name, description } = parsed.data;

  const [team] = await db
    .insert(teamsTable)
    .values({ cohortId, kind, name, description, createdById: userId })
    .returning();

  // Creator becomes lead
  await db.insert(teamMembersTable).values({ teamId: team.id, userId, role: "lead" });

  res.status(201).json(team);
});

// ─── GET /teams/:id ───────────────────────────────────────────────────────────

router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const members = await db
    .select({
      id: teamMembersTable.id,
      userId: teamMembersTable.userId,
      role: teamMembersTable.role,
      joinedAt: teamMembersTable.joinedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userAvatarUrl: usersTable.avatarUrl,
    })
    .from(teamMembersTable)
    .innerJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, id));

  res.json({ ...team, members });
});

// ─── PATCH /teams/:id ────────────────────────────────────────────────────────

const UpdateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.patch("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateTeamSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.user!.id;
  const userRole = req.user!.role;

  // Must be team lead or platform admin
  if (userRole !== "admin") {
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, id), eq(teamMembersTable.userId, userId)));
    if (!membership || membership.role !== "lead") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const [team] = await db
    .update(teamsTable)
    .set(parsed.data)
    .where(eq(teamsTable.id, id))
    .returning();

  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  res.json(team);
});

// ─── DELETE /teams/:id ────────────────────────────────────────────────────────

router.delete("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = req.user!.id;
  const userRole = req.user!.role;

  if (userRole !== "admin") {
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, id), eq(teamMembersTable.userId, userId)));
    if (!membership || membership.role !== "lead") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const [deleted] = await db.delete(teamsTable).where(eq(teamsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Team not found" }); return; }

  res.sendStatus(204);
});

export default router;
