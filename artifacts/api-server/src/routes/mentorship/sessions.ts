import { Router } from "express";
import { eq, and, or, lt, gt, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  mentoringSessionsTable,
  mentoringSessionParticipantsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── POST /mentors/:userId/sessions ──────────────────────────────────────────

const BookSessionBody = z.object({
  format: z.enum(["one_on_one", "group"]),
  topic: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  cohortId: z.number().int().optional(),
});

router.post(
  "/mentors/:userId/sessions",
  requireAuth,
  async (req, res): Promise<void> => {
    const mentorId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(mentorId)) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const parsed = BookSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      res.status(400).json({ error: "Invalid startsAt or endsAt date" });
      return;
    }

    if (endsAt <= startsAt) {
      res.status(400).json({ error: "endsAt must be after startsAt" });
      return;
    }

    // Check for overlapping scheduled sessions for this mentor
    const overlapping = await db
      .select({ id: mentoringSessionsTable.id })
      .from(mentoringSessionsTable)
      .where(
        and(
          eq(mentoringSessionsTable.mentorId, mentorId),
          eq(mentoringSessionsTable.status, "scheduled"),
          lt(mentoringSessionsTable.startsAt, endsAt),
          gt(mentoringSessionsTable.endsAt, startsAt),
        ),
      )
      .limit(1);

    if (overlapping.length > 0) {
      res.status(409).json({ error: "Mentor already has an overlapping scheduled session" });
      return;
    }

    const studentId = parsed.data.format === "one_on_one" ? req.user!.id : undefined;

    const [session] = await db
      .insert(mentoringSessionsTable)
      .values({
        mentorId,
        studentId: studentId ?? null,
        format: parsed.data.format,
        topic: parsed.data.topic ?? null,
        startsAt,
        endsAt,
        cohortId: parsed.data.cohortId ?? null,
        status: "scheduled",
      })
      .returning();

    res.status(201).json(session);
  },
);

// ─── POST /mentors/sessions/:id/participants ──────────────────────────────────

router.post(
  "/mentors/sessions/:id/participants",
  requireAuth,
  async (req, res): Promise<void> => {
    const sessionId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid session id" });
      return;
    }

    const studentId = req.user!.id;

    try {
      const [participant] = await db
        .insert(mentoringSessionParticipantsTable)
        .values({ sessionId, studentId })
        .onConflictDoNothing()
        .returning();

      // If no row returned, it was a conflict (already joined) — treat as success
      const result = participant ?? { sessionId, studentId };
      res.status(201).json(result);
    } catch {
      res.status(500).json({ error: "Failed to join session" });
    }
  },
);

// ─── GET /sessions/mine ───────────────────────────────────────────────────────

router.get("/sessions/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  // Get sessions where user is mentor or primary student
  const directSessions = await db
    .select({
      id: mentoringSessionsTable.id,
      mentorId: mentoringSessionsTable.mentorId,
      studentId: mentoringSessionsTable.studentId,
      cohortId: mentoringSessionsTable.cohortId,
      format: mentoringSessionsTable.format,
      status: mentoringSessionsTable.status,
      topic: mentoringSessionsTable.topic,
      startsAt: mentoringSessionsTable.startsAt,
      endsAt: mentoringSessionsTable.endsAt,
      meetingLink: mentoringSessionsTable.meetingLink,
      recordingUrl: mentoringSessionsTable.recordingUrl,
      createdAt: mentoringSessionsTable.createdAt,
      mentorName: usersTable.name,
    })
    .from(mentoringSessionsTable)
    .innerJoin(usersTable, eq(mentoringSessionsTable.mentorId, usersTable.id))
    .where(
      or(
        eq(mentoringSessionsTable.mentorId, userId),
        eq(mentoringSessionsTable.studentId, userId),
      ),
    );

  // Get sessions where user is a group participant
  const participantRows = await db
    .select({ sessionId: mentoringSessionParticipantsTable.sessionId })
    .from(mentoringSessionParticipantsTable)
    .where(eq(mentoringSessionParticipantsTable.studentId, userId));

  const participantSessionIds = participantRows
    .map((r) => r.sessionId)
    .filter((sid) => !directSessions.find((s) => s.id === sid));

  let participantSessions: typeof directSessions = [];
  if (participantSessionIds.length > 0) {
    participantSessions = await db
      .select({
        id: mentoringSessionsTable.id,
        mentorId: mentoringSessionsTable.mentorId,
        studentId: mentoringSessionsTable.studentId,
        cohortId: mentoringSessionsTable.cohortId,
        format: mentoringSessionsTable.format,
        status: mentoringSessionsTable.status,
        topic: mentoringSessionsTable.topic,
        startsAt: mentoringSessionsTable.startsAt,
        endsAt: mentoringSessionsTable.endsAt,
        meetingLink: mentoringSessionsTable.meetingLink,
        recordingUrl: mentoringSessionsTable.recordingUrl,
        createdAt: mentoringSessionsTable.createdAt,
        mentorName: usersTable.name,
      })
      .from(mentoringSessionsTable)
      .innerJoin(usersTable, eq(mentoringSessionsTable.mentorId, usersTable.id))
      .where(inArray(mentoringSessionsTable.id, participantSessionIds));
  }

  const allSessions = [...directSessions, ...participantSessions];

  // Sort upcoming first (ascending by startsAt)
  allSessions.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  res.json(allSessions);
});

// ─── PATCH /sessions/:id ──────────────────────────────────────────────────────

const PatchSessionBody = z.object({
  status: z.enum(["completed", "cancelled", "no_show"]).optional(),
  meetingLink: z.string().optional(),
  recordingUrl: z.string().optional(),
});

router.patch("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const parsed = PatchSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(mentoringSessionsTable)
    .where(eq(mentoringSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const user = req.user!;
  const isMentor = session.mentorId === user.id;
  const isStudent = session.studentId === user.id;
  const isAdmin = user.role === "admin";

  if (!isMentor && !isStudent && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Only mentor or admin can set completed/no_show
  if (
    parsed.data.status &&
    (parsed.data.status === "completed" || parsed.data.status === "no_show") &&
    !isMentor &&
    !isAdmin
  ) {
    res.status(403).json({ error: "Only the mentor or admin can mark a session as completed or no_show" });
    return;
  }

  const [updated] = await db
    .update(mentoringSessionsTable)
    .set({
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.meetingLink !== undefined ? { meetingLink: parsed.data.meetingLink } : {}),
      ...(parsed.data.recordingUrl !== undefined ? { recordingUrl: parsed.data.recordingUrl } : {}),
    })
    .where(eq(mentoringSessionsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── DELETE /sessions/:id ─────────────────────────────────────────────────────

router.delete("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const [session] = await db
    .select()
    .from(mentoringSessionsTable)
    .where(eq(mentoringSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const user = req.user!;
  const isMentor = session.mentorId === user.id;
  const isStudent = session.studentId === user.id;
  const isAdmin = user.role === "admin";

  if (!isMentor && !isStudent && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(mentoringSessionsTable)
    .set({ status: "cancelled" })
    .where(eq(mentoringSessionsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
