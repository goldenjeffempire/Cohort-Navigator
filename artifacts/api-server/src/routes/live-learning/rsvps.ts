/**
 * Live session RSVPs and attendance
 *
 * POST   /live-sessions/:id/rsvp        — upsert RSVP
 * DELETE /live-sessions/:id/rsvp        — remove RSVP
 * GET    /live-sessions/:id/rsvps       — list RSVPs
 * POST   /live-sessions/:id/attendance  — mark attendance (mentor/admin)
 * GET    /live-sessions/:id/attendance  — list attendance (mentor/admin)
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  liveSessionRsvpsTable,
  liveSessionAttendanceTable,
  liveSessionsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── POST /live-sessions/:id/rsvp ────────────────────────────────────────────

const RsvpBody = z.object({
  status: z.enum(["going", "interested", "declined"]),
});

router.post("/live-sessions/:id/rsvp", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const parsed = RsvpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [session] = await db
    .select({ id: liveSessionsTable.id })
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, sessionId))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const userId = req.user!.id;

  const [rsvp] = await db
    .insert(liveSessionRsvpsTable)
    .values({ sessionId, userId, status: parsed.data.status })
    .onConflictDoUpdate({
      target: [liveSessionRsvpsTable.sessionId, liveSessionRsvpsTable.userId],
      set: { status: parsed.data.status },
    })
    .returning();

  res.json(rsvp);
});

// ─── DELETE /live-sessions/:id/rsvp ──────────────────────────────────────────

router.delete("/live-sessions/:id/rsvp", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const userId = req.user!.id;

  await db
    .delete(liveSessionRsvpsTable)
    .where(
      and(
        eq(liveSessionRsvpsTable.sessionId, sessionId),
        eq(liveSessionRsvpsTable.userId, userId),
      ),
    );

  res.sendStatus(204);
});

// ─── GET /live-sessions/:id/rsvps ────────────────────────────────────────────

router.get("/live-sessions/:id/rsvps", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const rsvps = await db
    .select({
      id: liveSessionRsvpsTable.id,
      sessionId: liveSessionRsvpsTable.sessionId,
      userId: liveSessionRsvpsTable.userId,
      status: liveSessionRsvpsTable.status,
      createdAt: liveSessionRsvpsTable.createdAt,
      userName: usersTable.name,
      userAvatarUrl: usersTable.avatarUrl,
    })
    .from(liveSessionRsvpsTable)
    .innerJoin(usersTable, eq(liveSessionRsvpsTable.userId, usersTable.id))
    .where(eq(liveSessionRsvpsTable.sessionId, sessionId));

  res.json(rsvps);
});

// ─── POST /live-sessions/:id/attendance ──────────────────────────────────────

const AttendanceBody = z.object({
  userId: z.number().int(),
});

router.post(
  "/live-sessions/:id/attendance",
  requireAuth,
  requireRole("mentor", "admin"),
  async (req, res): Promise<void> => {
    const sessionId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }

    const parsed = AttendanceBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [record] = await db
      .insert(liveSessionAttendanceTable)
      .values({ sessionId, userId: parsed.data.userId })
      .onConflictDoNothing()
      .returning();

    res.status(201).json(record ?? { sessionId, userId: parsed.data.userId, alreadyMarked: true });
  },
);

// ─── GET /live-sessions/:id/attendance ───────────────────────────────────────

router.get(
  "/live-sessions/:id/attendance",
  requireAuth,
  requireRole("mentor", "admin"),
  async (req, res): Promise<void> => {
    const sessionId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }

    const records = await db
      .select({
        id: liveSessionAttendanceTable.id,
        sessionId: liveSessionAttendanceTable.sessionId,
        userId: liveSessionAttendanceTable.userId,
        joinedAt: liveSessionAttendanceTable.joinedAt,
        leftAt: liveSessionAttendanceTable.leftAt,
        userName: usersTable.name,
        userAvatarUrl: usersTable.avatarUrl,
      })
      .from(liveSessionAttendanceTable)
      .innerJoin(usersTable, eq(liveSessionAttendanceTable.userId, usersTable.id))
      .where(eq(liveSessionAttendanceTable.sessionId, sessionId));

    res.json(records);
  },
);

export default router;
