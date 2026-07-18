/**
 * Live sessions — classes, webinars, office hours, events, hackathons, competitions
 *
 * GET    /live-sessions        — list
 * POST   /live-sessions        — create (mentor/admin)
 * GET    /live-sessions/:id    — detail + myRsvp
 * PATCH  /live-sessions/:id    — update
 * DELETE /live-sessions/:id    — delete
 */
import { Router } from "express";
import { eq, and, gt, sql, count } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  liveSessionsTable,
  liveSessionRsvpsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── GET /live-sessions ───────────────────────────────────────────────────────

router.get("/live-sessions", requireAuth, async (req, res): Promise<void> => {
  const { cohortId, type, status, upcoming } = req.query;
  const userId = req.user!.id;

  const conditions: any[] = [];

  if (cohortId) {
    const cid = parseInt(String(cohortId), 10);
    if (!Number.isNaN(cid)) conditions.push(eq(liveSessionsTable.cohortId, cid));
  }
  if (type) conditions.push(eq(liveSessionsTable.type, type as any));
  if (status) conditions.push(eq(liveSessionsTable.status, status as any));
  if (upcoming === "true") conditions.push(gt(liveSessionsTable.startsAt, new Date()));

  const rows = await db
    .select({
      id: liveSessionsTable.id,
      cohortId: liveSessionsTable.cohortId,
      type: liveSessionsTable.type,
      status: liveSessionsTable.status,
      title: liveSessionsTable.title,
      description: liveSessionsTable.description,
      hostId: liveSessionsTable.hostId,
      startsAt: liveSessionsTable.startsAt,
      endsAt: liveSessionsTable.endsAt,
      meetingLink: liveSessionsTable.meetingLink,
      recordingUrl: liveSessionsTable.recordingUrl,
      relatedChallengeIds: liveSessionsTable.relatedChallengeIds,
      createdAt: liveSessionsTable.createdAt,
      hostName: usersTable.name,
      rsvpCount: sql<number>`(
        SELECT count(*) FROM live_session_rsvps
        WHERE live_session_rsvps.session_id = ${liveSessionsTable.id}
        AND live_session_rsvps.status = 'going'
      )::int`,
    })
    .from(liveSessionsTable)
    .leftJoin(usersTable, eq(liveSessionsTable.hostId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(liveSessionsTable.startsAt);

  // Enrich with current user's RSVP status
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [rsvp] = await db
        .select({ status: liveSessionRsvpsTable.status })
        .from(liveSessionRsvpsTable)
        .where(
          and(
            eq(liveSessionRsvpsTable.sessionId, row.id),
            eq(liveSessionRsvpsTable.userId, userId),
          ),
        )
        .limit(1);
      return { ...row, myRsvp: rsvp?.status ?? null };
    }),
  );

  res.json(enriched);
});

// ─── POST /live-sessions ──────────────────────────────────────────────────────

const CreateSessionBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["class", "webinar", "office_hours", "event", "hackathon", "competition"]),
  startsAt: z.string(),
  endsAt: z.string(),
  meetingLink: z.string().optional(),
  cohortId: z.number().int().optional(),
  relatedChallengeIds: z.string().optional(),
});

router.post(
  "/live-sessions",
  requireAuth,
  requireRole("mentor", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    if (endsAt <= startsAt) {
      res.status(400).json({ error: "endsAt must be after startsAt" });
      return;
    }

    const [session] = await db
      .insert(liveSessionsTable)
      .values({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        startsAt,
        endsAt,
        meetingLink: parsed.data.meetingLink ?? null,
        cohortId: parsed.data.cohortId ?? null,
        relatedChallengeIds: parsed.data.relatedChallengeIds ?? null,
        hostId: req.user!.id,
        status: "scheduled",
      })
      .returning();

    res.status(201).json(session);
  },
);

// ─── GET /live-sessions/:id ───────────────────────────────────────────────────

router.get("/live-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = req.user!.id;

  const [row] = await db
    .select({
      id: liveSessionsTable.id,
      cohortId: liveSessionsTable.cohortId,
      type: liveSessionsTable.type,
      status: liveSessionsTable.status,
      title: liveSessionsTable.title,
      description: liveSessionsTable.description,
      hostId: liveSessionsTable.hostId,
      startsAt: liveSessionsTable.startsAt,
      endsAt: liveSessionsTable.endsAt,
      meetingLink: liveSessionsTable.meetingLink,
      recordingUrl: liveSessionsTable.recordingUrl,
      relatedChallengeIds: liveSessionsTable.relatedChallengeIds,
      createdAt: liveSessionsTable.createdAt,
      hostName: usersTable.name,
      rsvpCount: sql<number>`(
        SELECT count(*) FROM live_session_rsvps
        WHERE live_session_rsvps.session_id = ${liveSessionsTable.id}
        AND live_session_rsvps.status = 'going'
      )::int`,
    })
    .from(liveSessionsTable)
    .leftJoin(usersTable, eq(liveSessionsTable.hostId, usersTable.id))
    .where(eq(liveSessionsTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Session not found" }); return; }

  const [rsvp] = await db
    .select({ status: liveSessionRsvpsTable.status })
    .from(liveSessionRsvpsTable)
    .where(and(eq(liveSessionRsvpsTable.sessionId, id), eq(liveSessionRsvpsTable.userId, userId)))
    .limit(1);

  res.json({ ...row, myRsvp: rsvp?.status ?? null });
});

// ─── PATCH /live-sessions/:id ─────────────────────────────────────────────────

const UpdateSessionBody = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).optional(),
  meetingLink: z.string().optional(),
  recordingUrl: z.string().optional(),
});

router.patch("/live-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [session] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, id))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const user = req.user!;
  if (session.hostId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [updated] = await db
    .update(liveSessionsTable)
    .set(parsed.data)
    .where(eq(liveSessionsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── DELETE /live-sessions/:id ────────────────────────────────────────────────

router.delete("/live-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, id))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const user = req.user!;
  if (session.hostId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(liveSessionsTable).where(eq(liveSessionsTable.id, id));
  res.sendStatus(204);
});

export default router;
