import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  contentReportsTable,
  communityAuditLogsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── POST /reports ────────────────────────────────────────────────────────────

const CreateReportBody = z.object({
  targetType: z.enum(["discussion_thread", "discussion_post", "message", "user"]),
  targetId: z.number().int(),
  reason: z.string().min(3),
});

router.post("/reports", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [report] = await db
    .insert(contentReportsTable)
    .values({
      reporterId: req.user!.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      status: "open",
    })
    .returning();
  res.status(201).json(report);
});

// ─── GET /reports ─────────────────────────────────────────────────────────────

const ListReportsQuery = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]).optional(),
  targetType: z.enum(["discussion_thread", "discussion_post", "message", "user"]).optional(),
});

router.get(
  "/reports",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const parsed = ListReportsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const conditions = [];
    if (parsed.data.status) {
      conditions.push(eq(contentReportsTable.status, parsed.data.status));
    }
    if (parsed.data.targetType) {
      conditions.push(eq(contentReportsTable.targetType, parsed.data.targetType));
    }

    const rows = await db
      .select({
        id: contentReportsTable.id,
        reporterId: contentReportsTable.reporterId,
        reporterName: usersTable.name,
        targetType: contentReportsTable.targetType,
        targetId: contentReportsTable.targetId,
        reason: contentReportsTable.reason,
        status: contentReportsTable.status,
        resolvedById: contentReportsTable.resolvedById,
        resolutionNote: contentReportsTable.resolutionNote,
        createdAt: contentReportsTable.createdAt,
        resolvedAt: contentReportsTable.resolvedAt,
      })
      .from(contentReportsTable)
      .leftJoin(usersTable, eq(contentReportsTable.reporterId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentReportsTable.createdAt));

    res.json(rows);
  },
);

// ─── PATCH /reports/:id ───────────────────────────────────────────────────────

const UpdateReportBody = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolutionNote: z.string().optional(),
});

router.patch(
  "/reports/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updateValues: Partial<typeof contentReportsTable.$inferInsert> & {
      resolvedById?: number | null;
      resolvedAt?: Date | null;
    } = {
      status: parsed.data.status,
      resolutionNote: parsed.data.resolutionNote ?? null,
    };

    const isTerminal = parsed.data.status === "resolved" || parsed.data.status === "dismissed";
    if (isTerminal) {
      updateValues.resolvedById = req.user!.id;
      updateValues.resolvedAt = new Date();
    }

    const [report] = await db
      .update(contentReportsTable)
      .set(updateValues)
      .where(eq(contentReportsTable.id, id))
      .returning();

    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    // Insert audit log on resolve/dismiss
    if (isTerminal) {
      const event =
        parsed.data.status === "resolved" ? "report_resolved" : "report_dismissed";
      await db.insert(communityAuditLogsTable).values({
        communityId: null,
        actorId: req.user!.id,
        event,
        targetType: report.targetType,
        targetId: report.targetId,
        detail: parsed.data.resolutionNote ?? null,
      });
    }

    res.json(report);
  },
);

export default router;
