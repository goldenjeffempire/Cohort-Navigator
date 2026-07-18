/**
 * Team invitations
 *
 * POST  /teams/:id/invitations          — invite a user (team lead)
 * GET   /teams/:id/invitations          — list pending invitations (lead/admin)
 * POST  /teams/invitations/:id/accept   — accept invitation
 * POST  /teams/invitations/:id/decline  — decline invitation
 * GET   /invitations/mine               — current user's pending invitations
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  teamInvitationsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

async function getTeamMembership(teamId: number, userId: number) {
  const [m] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)))
    .limit(1);
  return m ?? null;
}

// ─── GET /invitations/mine — must be before /teams/:id/invitations ─────────

router.get("/invitations/mine", requireAuth, async (req, res): Promise<void> => {
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
      inviterName: usersTable.name,
    })
    .from(teamInvitationsTable)
    .innerJoin(teamsTable, eq(teamInvitationsTable.teamId, teamsTable.id))
    .innerJoin(usersTable, eq(teamInvitationsTable.invitedById, usersTable.id))
    .where(
      and(
        eq(teamInvitationsTable.invitedUserId, userId),
        eq(teamInvitationsTable.status, "pending"),
      ),
    );

  res.json(invitations);
});

// ─── POST /teams/:id/invitations ──────────────────────────────────────────────

const InviteBody = z.object({ invitedUserId: z.number().int() });

router.post("/teams/:id/invitations", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(teamId)) { res.status(400).json({ error: "Invalid team id" }); return; }

  const parsed = InviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const user = req.user!;
  if (user.role !== "admin") {
    const m = await getTeamMembership(teamId, user.id);
    if (!m || m.role !== "lead") {
      res.status(403).json({ error: "Forbidden — team lead only" }); return;
    }
  }

  const { invitedUserId } = parsed.data;

  // Check target not already a member
  const existing = await getTeamMembership(teamId, invitedUserId);
  if (existing) {
    res.status(409).json({ error: "User is already a team member" }); return;
  }

  try {
    const [invitation] = await db
      .insert(teamInvitationsTable)
      .values({ teamId, invitedUserId, invitedById: user.id, status: "pending" })
      .onConflictDoNothing()
      .returning();

    if (!invitation) {
      res.status(409).json({ error: "Invitation already pending" }); return;
    }

    res.status(201).json(invitation);
  } catch {
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// ─── GET /teams/:id/invitations ───────────────────────────────────────────────

router.get("/teams/:id/invitations", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(teamId)) { res.status(400).json({ error: "Invalid team id" }); return; }

  const user = req.user!;
  if (user.role !== "admin") {
    const m = await getTeamMembership(teamId, user.id);
    if (!m || m.role !== "lead") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }

  const invitations = await db
    .select({
      id: teamInvitationsTable.id,
      teamId: teamInvitationsTable.teamId,
      invitedUserId: teamInvitationsTable.invitedUserId,
      status: teamInvitationsTable.status,
      createdAt: teamInvitationsTable.createdAt,
      inviteeName: usersTable.name,
      inviteeEmail: usersTable.email,
    })
    .from(teamInvitationsTable)
    .innerJoin(usersTable, eq(teamInvitationsTable.invitedUserId, usersTable.id))
    .where(
      and(
        eq(teamInvitationsTable.teamId, teamId),
        eq(teamInvitationsTable.status, "pending"),
      ),
    );

  res.json(invitations);
});

// ─── POST /teams/invitations/:id/accept ──────────────────────────────────────

router.post("/teams/invitations/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid invitation id" }); return; }

  const [invitation] = await db
    .select()
    .from(teamInvitationsTable)
    .where(eq(teamInvitationsTable.id, id))
    .limit(1);

  if (!invitation) { res.status(404).json({ error: "Invitation not found" }); return; }

  const user = req.user!;
  if (invitation.invitedUserId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  if (invitation.status !== "pending") {
    res.status(409).json({ error: `Invitation is already ${invitation.status}` }); return;
  }

  await db
    .update(teamInvitationsTable)
    .set({ status: "accepted" })
    .where(eq(teamInvitationsTable.id, id));

  await db
    .insert(teamMembersTable)
    .values({ teamId: invitation.teamId, userId: user.id, role: "member" })
    .onConflictDoNothing();

  res.json({ status: "accepted" });
});

// ─── POST /teams/invitations/:id/decline ─────────────────────────────────────

router.post("/teams/invitations/:id/decline", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid invitation id" }); return; }

  const [invitation] = await db
    .select()
    .from(teamInvitationsTable)
    .where(eq(teamInvitationsTable.id, id))
    .limit(1);

  if (!invitation) { res.status(404).json({ error: "Invitation not found" }); return; }

  const user = req.user!;
  if (invitation.invitedUserId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  if (invitation.status !== "pending") {
    res.status(409).json({ error: `Invitation is already ${invitation.status}` }); return;
  }

  await db
    .update(teamInvitationsTable)
    .set({ status: "declined" })
    .where(eq(teamInvitationsTable.id, id));

  res.json({ status: "declined" });
});

export default router;
