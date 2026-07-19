import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ── Raw table helpers (not in generated Drizzle schema yet) ──────────────────

async function getQuestions(activeOnly = true) {
  const rows = await db.execute(
    sql`SELECT * FROM probation_assessment_questions
        ${activeOnly ? sql`WHERE is_active = TRUE` : sql``}
        ORDER BY order_index ASC, id ASC`
  );
  return rows.rows as any[];
}

async function getAttempt(applicationId: number) {
  const rows = await db.execute(
    sql`SELECT * FROM probation_assessment_attempts WHERE scholarship_application_id = ${applicationId} ORDER BY started_at DESC LIMIT 1`
  );
  return rows.rows[0] as any | undefined;
}

// ── Admin: Question bank ───────────────────────────────────────────────────

router.get("/admin/assessment-questions", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const questions = await getQuestions(false);
  res.json(questions);
});

router.post("/admin/assessment-questions", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const body = z.object({
    question: z.string().min(1),
    options: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
    correctOptionId: z.string(),
    explanation: z.string().optional(),
    points: z.number().int().min(1).default(1),
    orderIndex: z.number().int().default(0),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;
  const rows = await db.execute(
    sql`INSERT INTO probation_assessment_questions (question, options, correct_option_id, explanation, points, order_index)
        VALUES (${d.question}, ${JSON.stringify(d.options)}::jsonb, ${d.correctOptionId}, ${d.explanation ?? null}, ${d.points}, ${d.orderIndex})
        RETURNING *`
  );
  res.status(201).json(rows.rows[0]);
});

router.patch("/admin/assessment-questions/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({
    question: z.string().min(1).optional(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    correctOptionId: z.string().optional(),
    explanation: z.string().optional(),
    points: z.number().int().min(1).optional(),
    orderIndex: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const d = body.data;

  const setClauses: string[] = [];
  const values: any[] = [];
  if (d.question !== undefined) { setClauses.push(`question = $${values.length + 1}`); values.push(d.question); }
  if (d.options !== undefined) { setClauses.push(`options = $${values.length + 1}::jsonb`); values.push(JSON.stringify(d.options)); }
  if (d.correctOptionId !== undefined) { setClauses.push(`correct_option_id = $${values.length + 1}`); values.push(d.correctOptionId); }
  if (d.explanation !== undefined) { setClauses.push(`explanation = $${values.length + 1}`); values.push(d.explanation); }
  if (d.points !== undefined) { setClauses.push(`points = $${values.length + 1}`); values.push(d.points); }
  if (d.orderIndex !== undefined) { setClauses.push(`order_index = $${values.length + 1}`); values.push(d.orderIndex); }
  if (d.isActive !== undefined) { setClauses.push(`is_active = $${values.length + 1}`); values.push(d.isActive); }

  if (setClauses.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  values.push(id);

  const rows = await (db as any).$client.query(
    `UPDATE probation_assessment_questions SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  res.json(rows.rows[0]);
});

router.delete("/admin/assessment-questions/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.execute(sql`DELETE FROM probation_assessment_questions WHERE id = ${id}`);
  res.status(204).send();
});

// ── Student: Take assessment ────────────────────────────────────────────────

// GET my current assessment state (questions without correct answers, + attempt status)
router.get("/scholarship-applications/:id/assessment", requireAuth, async (req, res): Promise<void> => {
  const appId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(appId)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Check app belongs to user or admin
  const appRows = await db.execute(sql`SELECT * FROM scholarship_applications WHERE id = ${appId} LIMIT 1`);
  const app = appRows.rows[0] as any;
  if (!app) { res.status(404).json({ error: "Not found" }); return; }
  if (app.applicant_user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (app.status !== "probation_assessment" && req.user!.role !== "admin") {
    res.status(403).json({ error: "Assessment not yet unlocked" }); return;
  }

  const questions = await getQuestions(true);
  // Strip correct answers for students
  const sanitized = req.user!.role === "admin"
    ? questions
    : questions.map(({ correct_option_id, explanation, ...q }: any) => q);

  const attempt = await getAttempt(appId);
  res.json({ questions: sanitized, attempt: attempt ?? null, timeLimitMinutes: 60 });
});

// POST start attempt
router.post("/scholarship-applications/:id/assessment/start", requireAuth, async (req, res): Promise<void> => {
  const appId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(appId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const appRows = await db.execute(sql`SELECT * FROM scholarship_applications WHERE id = ${appId} LIMIT 1`);
  const app = appRows.rows[0] as any;
  if (!app) { res.status(404).json({ error: "Not found" }); return; }
  if (app.applicant_user_id !== req.user!.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (app.status !== "probation_assessment") { res.status(403).json({ error: "Assessment not yet unlocked" }); return; }

  // Prevent restarting a completed attempt
  const existing = await getAttempt(appId);
  if (existing?.is_completed) { res.status(409).json({ error: "Assessment already completed", attempt: existing }); return; }
  if (existing && !existing.is_completed) { res.json(existing); return; } // return existing in-progress

  const rows = await db.execute(
    sql`INSERT INTO probation_assessment_attempts (scholarship_application_id, user_id, time_limit_minutes)
        VALUES (${appId}, ${req.user!.id}, 60) RETURNING *`
  );
  res.status(201).json(rows.rows[0]);
});

// POST submit assessment
router.post("/scholarship-applications/:id/assessment/submit", requireAuth, async (req, res): Promise<void> => {
  const appId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(appId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = z.object({
    answers: z.record(z.string(), z.string()), // { questionId: selectedOptionId }
    isAutoSubmitted: z.boolean().default(false),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const appRows = await db.execute(sql`SELECT * FROM scholarship_applications WHERE id = ${appId} LIMIT 1`);
  const app = appRows.rows[0] as any;
  if (!app) { res.status(404).json({ error: "Not found" }); return; }
  if (app.applicant_user_id !== req.user!.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const attempt = await getAttempt(appId);
  if (!attempt) { res.status(400).json({ error: "No active attempt — call /start first" }); return; }
  if (attempt.is_completed) { res.status(409).json({ error: "Already submitted", attempt }); return; }

  // Auto-grade
  const questions = await getQuestions(true);
  let correct = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  for (const q of questions) {
    totalPoints += q.points;
    const selected = body.data.answers[String(q.id)];
    if (selected === q.correct_option_id) {
      correct++;
      earnedPoints += q.points;
    }
  }
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = score >= 70;

  // Update attempt
  await db.execute(
    sql`UPDATE probation_assessment_attempts
        SET answers = ${JSON.stringify(body.data.answers)}::jsonb,
            score = ${score},
            total_questions = ${questions.length},
            correct_answers = ${correct},
            submitted_at = NOW(),
            is_auto_submitted = ${body.data.isAutoSubmitted},
            is_completed = TRUE
        WHERE id = ${attempt.id}`
  );

  // Auto-advance the application workflow
  const newStatus = passed ? "fully_admitted" : "not_admitted";
  const reviewNotes = passed
    ? `Assessment passed with ${score}%. Congratulations!`
    : `Assessment score: ${score}% — below the 70% passing threshold. Score: ${correct}/${questions.length} questions correct.`;

  // Update application
  await db.execute(
    sql`UPDATE scholarship_applications
        SET status = ${newStatus}::scholarship_status,
            assessment_score = ${score},
            assessment_completed_at = NOW(),
            review_notes = ${reviewNotes},
            reviewed_at = NOW()
        WHERE id = ${appId}`
  );

  // Log status history
  await db.execute(
    sql`INSERT INTO scholarship_status_history (application_id, previous_status, new_status, changed_by_user_id, notes)
        VALUES (${appId}, 'probation_assessment', ${newStatus}, ${req.user!.id}, ${reviewNotes})`
  );

  // Update user role
  if (passed) {
    const studentId = `JOE-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await db.execute(
      sql`UPDATE users SET role = 'student', student_id = ${studentId} WHERE id = ${app.applicant_user_id}`
    );
    await db.execute(
      sql`INSERT INTO notifications (user_id, type, title, body, link)
          VALUES (${app.applicant_user_id}, 'scholarship_review',
            '🎓 Fully Admitted — Welcome to JOE Forge!',
            ${'Congratulations! You scored ' + score + '% on your admission assessment and have been fully admitted. Your Student ID has been generated.'},
            '/scholarship/status')`
    );
  } else {
    await db.execute(sql`UPDATE users SET role = 'student' WHERE id = ${app.applicant_user_id}`);
    await db.execute(
      sql`INSERT INTO notifications (user_id, type, title, body, link)
          VALUES (${app.applicant_user_id}, 'scholarship_review',
            'Admission Assessment Result',
            ${'Your assessment score was ' + score + '%. The passing score is 70%. Please review the feedback on your application page.'},
            '/scholarship/status')`
    );
  }

  res.json({
    score,
    passed,
    correct,
    total: questions.length,
    status: newStatus,
    feedback: reviewNotes,
  });
});

// GET status history for an application (admin or owner)
router.get("/scholarship-applications/:id/history", requireAuth, async (req, res): Promise<void> => {
  const appId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(appId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const appRows = await db.execute(sql`SELECT applicant_user_id FROM scholarship_applications WHERE id = ${appId} LIMIT 1`);
  const app = appRows.rows[0] as any;
  if (!app) { res.status(404).json({ error: "Not found" }); return; }
  if (app.applicant_user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const rows = await db.execute(
    sql`SELECT h.*, u.name as changed_by_name
        FROM scholarship_status_history h
        LEFT JOIN users u ON h.changed_by_user_id = u.id
        WHERE h.application_id = ${appId}
        ORDER BY h.changed_at ASC`
  );
  res.json(rows.rows);
});

export default router;
