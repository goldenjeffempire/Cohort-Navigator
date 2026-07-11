/**
 * Plagiarism detection routes:
 *
 * GET  /plagiarism/:challengeId       - get existing reports for a challenge
 * POST /plagiarism/:challengeId/run   - run new analysis (admin/mentor)
 * PATCH /plagiarism/reports/:id       - review / dismiss a report (admin/mentor)
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  plagiarismReportsTable,
  challengeSubmissionsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { compareManySubmissions } from "../lib/plagiarism";

const router: IRouter = Router();

// ─── Get existing reports ─────────────────────────────────────────────────────

router.get(
  "/plagiarism/:challengeId",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const challengeId = parseInt(req.params.challengeId);

    const reports = await db
      .select()
      .from(plagiarismReportsTable)
      .where(eq(plagiarismReportsTable.challengeId, challengeId))
      .orderBy(desc(plagiarismReportsTable.similarityScore));

    // Enrich with student names
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const [s1] = await db
          .select({ name: usersTable.name, email: usersTable.email })
          .from(challengeSubmissionsTable)
          .leftJoin(usersTable, eq(challengeSubmissionsTable.studentId, usersTable.id))
          .where(eq(challengeSubmissionsTable.id, r.submission1Id));

        const [s2] = await db
          .select({ name: usersTable.name, email: usersTable.email })
          .from(challengeSubmissionsTable)
          .leftJoin(usersTable, eq(challengeSubmissionsTable.studentId, usersTable.id))
          .where(eq(challengeSubmissionsTable.id, r.submission2Id));

        return {
          ...r,
          student1Name: s1?.name,
          student2Name: s2?.name,
          student1Email: s1?.email,
          student2Email: s2?.email,
        };
      }),
    );

    res.json(enriched);
  },
);

// ─── Run analysis ─────────────────────────────────────────────────────────────

router.post(
  "/plagiarism/:challengeId/run",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const challengeId = parseInt(req.params.challengeId);

    // Get the best (highest-scoring) submission per student for this challenge
    const allSubmissions = await db
      .select({
        submission: challengeSubmissionsTable,
        studentName: usersTable.name,
      })
      .from(challengeSubmissionsTable)
      .leftJoin(usersTable, eq(challengeSubmissionsTable.studentId, usersTable.id))
      .where(eq(challengeSubmissionsTable.challengeId, challengeId))
      .orderBy(desc(challengeSubmissionsTable.score));

    // Keep best submission per student
    const bestByStudent = new Map<number, { id: number; code: string; studentName: string }>();
    for (const { submission, studentName } of allSubmissions) {
      if (!bestByStudent.has(submission.studentId)) {
        bestByStudent.set(submission.studentId, {
          id: submission.id,
          code: submission.code,
          studentName: studentName ?? "Unknown",
        });
      }
    }

    if (bestByStudent.size < 2) {
      res.json({ message: "Need at least 2 submissions to compare", reports: [] });
      return;
    }

    // Run comparison
    const pairs = compareManySubmissions(Array.from(bestByStudent.values()));

    // Clear old reports for this challenge
    await db
      .delete(plagiarismReportsTable)
      .where(eq(plagiarismReportsTable.challengeId, challengeId));

    // Store new reports
    const reports = [];
    for (const pair of pairs) {
      const [report] = await db
        .insert(plagiarismReportsTable)
        .values({
          challengeId,
          submission1Id: pair.submission1Id,
          submission2Id: pair.submission2Id,
          similarityScore: pair.similarityScore,
          flagged: pair.flagged,
        })
        .returning();
      reports.push({
        ...report,
        student1Name: pair.student1Name,
        student2Name: pair.student2Name,
      });
    }

    res.json({
      message: `Compared ${bestByStudent.size} submissions. Found ${reports.filter((r) => r.flagged).length} flagged pairs.`,
      reports,
    });
  },
);

// ─── Review a report ──────────────────────────────────────────────────────────

router.patch(
  "/plagiarism/reports/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    const { flagged } = req.body as { flagged?: boolean };

    if (flagged === undefined) {
      res.status(400).json({ error: "flagged field is required" }); return;
    }

    const [updated] = await db
      .update(plagiarismReportsTable)
      .set({
        flagged,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(plagiarismReportsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Report not found" }); return; }
    res.json(updated);
  },
);

export default router;
