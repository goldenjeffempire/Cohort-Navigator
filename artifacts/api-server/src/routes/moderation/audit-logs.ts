import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  communityAuditLogsTable,
  communityMembersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ─── GET /communities/:communityId/audit-logs ─────────────────────────────────

router.get(
  "/communities/:communityId/audit-logs",
  requireAuth,
  async (req, res): Promise<void> => {
    const communityId = parseInt(String(req.params.communityId), 10);
    if (Number.isNaN(communityId)) {
      res.status(400).json({ error: "Invalid communityId" });
      return;
    }

    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const caller = req.user!;

    // Platform admin bypasses community membership check
    if (caller.role !== "admin") {
      const [membership] = await db
        .select({ role: communityMembersTable.role })
        .from(communityMembersTable)
        .where(
          and(
            eq(communityMembersTable.communityId, communityId),
            eq(communityMembersTable.userId, caller.id),
          ),
        )
        .limit(1);

      if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const rows = await db
      .select({
        id: communityAuditLogsTable.id,
        communityId: communityAuditLogsTable.communityId,
        actorId: communityAuditLogsTable.actorId,
        actorName: usersTable.name,
        event: communityAuditLogsTable.event,
        targetType: communityAuditLogsTable.targetType,
        targetId: communityAuditLogsTable.targetId,
        detail: communityAuditLogsTable.detail,
        createdAt: communityAuditLogsTable.createdAt,
      })
      .from(communityAuditLogsTable)
      .leftJoin(usersTable, eq(communityAuditLogsTable.actorId, usersTable.id))
      .where(eq(communityAuditLogsTable.communityId, communityId))
      .orderBy(desc(communityAuditLogsTable.createdAt))
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);

    res.json(rows);
  },
);

// ─── GET /audit-logs ──────────────────────────────────────────────────────────

router.get(
  "/audit-logs",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const rows = await db
      .select({
        id: communityAuditLogsTable.id,
        communityId: communityAuditLogsTable.communityId,
        actorId: communityAuditLogsTable.actorId,
        actorName: usersTable.name,
        event: communityAuditLogsTable.event,
        targetType: communityAuditLogsTable.targetType,
        targetId: communityAuditLogsTable.targetId,
        detail: communityAuditLogsTable.detail,
        createdAt: communityAuditLogsTable.createdAt,
      })
      .from(communityAuditLogsTable)
      .leftJoin(usersTable, eq(communityAuditLogsTable.actorId, usersTable.id))
      .orderBy(desc(communityAuditLogsTable.createdAt))
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);

    res.json(rows);
  },
);

export default router;
