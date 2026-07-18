/**
 * Session feedback — bidirectional (mentor ↔ student)
 *
 * POST  /sessions/:id/feedback  — submit feedback
 * GET   /sessions/:id/feedback  — read feedback (session parties + admin)
 */
import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  sessionFeedbackTable,
  mentoringSessionsTable,
  mentoringSessionParticipantsTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

const FeedbackBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  authorRole: z.enum(["mentor", "student"]),
});

// ─── POST /sessions/:id/feedback ─────────────────────────────────────────────

router.post("/sessions/:id/feedback", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(mentoringSessionsTable)
    .where(eq(mentoringSessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const user = req.user!;
  const isMentor = session.mentorId === user.id;
  const isDirectStudent = session.studentId === user.id;

  // Check if user is a group participant
  let isParticipant = false;
  if (!isMentor && !isDirectStudent) {
    const [p] = await db
      .select()
      .from(mentoringSessionParticipantsTable)
      .where(
        and(
          eq(mentoringSessionParticipantsTable.sessionId, sessionId),
          eq(mentoringSessionParticipantsTable.studentId, user.id),
        ),
      )
      .limit(1);
    isParticipant = !!p;
  }

  if (!isMentor && !isDirectStudent && !isParticipant && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden — not a session participant" });
    return;
  }

  // Validate authorRole matches actual role
  if (parsed.data.authorRole === "mentor" && !isMentor && user.role !== "admin") {
    res.status(400).json({ error: "Only the mentor can submit mentor feedback" });
    return;
  }

  const [feedback] = await db
    .insert(sessionFeedbackTable)
    .values({
      sessionId,
      authorId: user.id,
      authorRole: parsed.data.authorRole,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!feedback) {
    res.status(409).json({ error: "Feedback already submitted for this session" });
    return;
  }

  res.status(201).json(feedback);
});

// ─── GET /sessions/:id/feedback ──────────────────────────────────────────────

router.get("/sessions/:id/feedback", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const [session] = await db
    .select()
    .from(mentoringSessionsTable)
    .where(eq(mentoringSessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const user = req.user!;
  const canView =
    user.role === "admin" ||
    session.mentorId === user.id ||
    session.studentId === user.id;

  if (!canView) {
    // Check group participants
    const [p] = await db
      .select()
      .from(mentoringSessionParticipantsTable)
      .where(
        and(
          eq(mentoringSessionParticipantsTable.sessionId, sessionId),
          eq(mentoringSessionParticipantsTable.studentId, user.id),
        ),
      )
      .limit(1);

    if (!p) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const feedback = await db
    .select()
    .from(sessionFeedbackTable)
    .where(eq(sessionFeedbackTable.sessionId, sessionId));

  res.json(feedback);
});

export default router;
