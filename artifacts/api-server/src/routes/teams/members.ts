import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  teamMembersTable,
  teamInvitationsTable,
  teamsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// ─── POST /teams/:id/invitations ─────────────────────────────────────────────

const CreateInvitationSchema = z.object({
  invitedUserId: z.number().int(),
});

router.post("/teams/:id/invitations", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(teamId)) { res.status(400).json({ error: "Invalid team id" }); return; }

  const parsed = CreateInvitationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.user!.id;
  const userRole = req.user!.role;

  // Must be team lead or admin
  if (userRole !== "admin") {
    const [membership] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
    if (!membership || membership.role !== "lead") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const { invitedUserId } = parsed.data;

  // If an invitation already exists, return it instead of erroring
  const [existing] = await db
    .select()
    .from(teamInvitationsTable)
    .where(and(eq(teamInvitationsTable.teamId, teamId), eq(teamInvitationsTable.invitedUserId, invitedUserId)));
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const [invitation] = await db
    .insert(teamInvitationsTable)
    .values({ teamId, invitedUserId, invitedById: userId, status: "pending" })
    .returning();

  res.status(201).json(invitation);
});

// ─── GET /teams/invitations/mine ─────────────────────────────────────────────
// NOTE: This route must be declared BEFORE /teams/:id to avoid :id capturing "invitations"

router.get("/teams/invitations/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const invitations = await db
    .select({
      id: teamInvitationsTable.id,
      teamId: teamInvitationsTable.teamId,
      invitedUserId: teamInvitationsTable.invitedUserId,
      invitedById: teamInvitationsTable.invitedById,
      status: teamInvitationsTable.status,
      createdAt: teamInvitationsTable.createdAt,
      teamName: teamsTable.name,
      teamKind: teamsTable.kind,
      teamDescription: teamsTable.description,
    })
    .from(teamInvitationsTable)
    .innerJoin(teamsTable, eq(teamInvitationsTable.teamId, teamsTable.id))
    .where(
      and(
        eq(teamInvitationsTable.invitedUserId, userId),
        eq(teamInvitationsTable.status, "pending"),
      ),
    );

  res.json(invitations);
});

// ─── POST /teams/invitations/:id/accept ──────────────────────────────────────

router.post("/teams/invitations/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const invId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(invId)) { res.status(400).json({ error: "Invalid invitation id" }); return; }

  const userId = req.user!.id;

  const [invitation] = await db
    .select()
    .from(teamInvitationsTable)
    .where(eq(teamInvitationsTable.id, invId));

  if (!invitation) { res.status(404).json({ error: "Invitation not found" }); return; }
  if (invitation.invitedUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (invitation.status !== "pending") {
    res.status(400).json({ error: "Invitation is no longer pending" });
    return;
  }

  // Insert team member row (ignore if already a member)
  await db
    .insert(teamMembersTable)
    .values({ teamId: invitation.teamId, userId, role: "member" })
    .onConflictDoNothing();

  const [updated] = await db
    .update(teamInvitationsTable)
    .set({ status: "accepted" })
    .where(eq(teamInvitationsTable.id, invId))
    .returning();

  res.json(updated);
});

// ─── POST /teams/invitations/:id/decline ─────────────────────────────────────

router.post("/teams/invitations/:id/decline", requireAuth, async (req, res): Promise<void> => {
  const invId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(invId)) { res.status(400).json({ error: "Invalid invitation id" }); return; }

  const userId = req.user!.id;

  const [invitation] = await db
    .select()
    .from(teamInvitationsTable)
    .where(eq(teamInvitationsTable.id, invId));

  if (!invitation) { res.status(404).json({ error: "Invitation not found" }); return; }
  if (invitation.invitedUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (invitation.status !== "pending") {
    res.status(400).json({ error: "Invitation is no longer pending" });
    return;
  }

  const [updated] = await db
    .update(teamInvitationsTable)
    .set({ status: "declined" })
    .where(eq(teamInvitationsTable.id, invId))
    .returning();

  res.json(updated);
});

// ─── DELETE /teams/:id/members/:userId ───────────────────────────────────────

router.delete("/teams/:id/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  const targetUserId = parseInt(String(req.params.userId), 10);
  if (Number.isNaN(teamId) || Number.isNaN(targetUserId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const callerId = req.user!.id;
  const callerRole = req.user!.role;

  // Determine if caller is allowed: platform admin, team lead, or the member themselves (leave)
  const isSelf = callerId === targetUserId;
  const isAdmin = callerRole === "admin";

  if (!isSelf && !isAdmin) {
    const [callerMembership] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, callerId)));
    if (!callerMembership || callerMembership.role !== "lead") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const [deleted] = await db
    .delete(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, targetUserId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Member not found" }); return; }

  res.sendStatus(204);
});

export default router;
