/**
 * Discord / Slack integration configuration (admin only)
 *
 * GET    /integrations                — list configs
 * POST   /integrations                — create / upsert config
 * PATCH  /integrations/:id            — partial update
 * DELETE /integrations/:id            — delete
 * POST   /integrations/:id/test       — send test notification
 * GET    /integrations/sync-logs      — audit of sync events
 */
import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  communityIntegrationsTable,
  integrationSyncLogsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── GET /integrations ────────────────────────────────────────────────────────

router.get(
  "/integrations",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const cohortId = req.query.cohortId
      ? parseInt(String(req.query.cohortId), 10)
      : undefined;

    const rows = cohortId && !Number.isNaN(cohortId)
      ? await db
          .select()
          .from(communityIntegrationsTable)
          .where(eq(communityIntegrationsTable.cohortId, cohortId))
      : await db.select().from(communityIntegrationsTable);

    res.json(rows);
  },
);

// ─── POST /integrations ───────────────────────────────────────────────────────

const ConfigBody = z.object({
  cohortId: z.number().int().optional(),
  provider: z.enum(["discord", "slack"]),
  externalWorkspaceId: z.string().optional(),
  channelMap: z.record(z.string(), z.string()).optional(),
  syncAnnouncements: z.boolean().optional(),
  syncAssignments: z.boolean().optional(),
  syncEventReminders: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

router.post(
  "/integrations",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = ConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const configuredById = req.user!.id;
    const now = new Date();

    const [record] = await db
      .insert(communityIntegrationsTable)
      .values({
        ...parsed.data,
        cohortId: parsed.data.cohortId ?? null,
        configuredById,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [communityIntegrationsTable.cohortId, communityIntegrationsTable.provider],
        set: {
          externalWorkspaceId: parsed.data.externalWorkspaceId,
          channelMap: parsed.data.channelMap,
          syncAnnouncements: parsed.data.syncAnnouncements,
          syncAssignments: parsed.data.syncAssignments,
          syncEventReminders: parsed.data.syncEventReminders,
          isEnabled: parsed.data.isEnabled,
          configuredById,
          updatedAt: now,
        },
      })
      .returning();

    res.status(201).json(record);
  },
);

// ─── PATCH /integrations/:id ──────────────────────────────────────────────────

const PatchBody = z.object({
  externalWorkspaceId: z.string().optional(),
  channelMap: z.record(z.string(), z.string()).optional(),
  syncAnnouncements: z.boolean().optional(),
  syncAssignments: z.boolean().optional(),
  syncEventReminders: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

router.patch(
  "/integrations/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [updated] = await db
      .update(communityIntegrationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(communityIntegrationsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Integration not found" }); return; }
    res.json(updated);
  },
);

// ─── DELETE /integrations/:id ─────────────────────────────────────────────────

router.delete(
  "/integrations/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [deleted] = await db
      .delete(communityIntegrationsTable)
      .where(eq(communityIntegrationsTable.id, id))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Integration not found" }); return; }
    res.sendStatus(204);
  },
);

// ─── GET /integrations/sync-logs ─────────────────────────────────────────────
// Must be defined BEFORE /integrations/:id/test to avoid route conflict

router.get(
  "/integrations/sync-logs",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const integrationId = req.query.integrationId
      ? parseInt(String(req.query.integrationId), 10)
      : undefined;

    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);

    const rows = integrationId && !Number.isNaN(integrationId)
      ? await db
          .select()
          .from(integrationSyncLogsTable)
          .where(eq(integrationSyncLogsTable.integrationId, integrationId))
          .orderBy(desc(integrationSyncLogsTable.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(integrationSyncLogsTable)
          .orderBy(desc(integrationSyncLogsTable.createdAt))
          .limit(limit);

    res.json(rows);
  },
);

// ─── POST /integrations/:id/test ─────────────────────────────────────────────

router.post(
  "/integrations/:id/test",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [integration] = await db
      .select()
      .from(communityIntegrationsTable)
      .where(eq(communityIntegrationsTable.id, id))
      .limit(1);

    if (!integration) { res.status(404).json({ error: "Integration not found" }); return; }

    const webhookUrl = integration.channelMap?.["webhook"];
    if (!webhookUrl) {
      res.json({ ok: false, detail: "No webhook URL configured. Add a webhook URL to channelMap.webhook." });
      return;
    }

    let ok = false;
    let detail = "";

    try {
      const body =
        integration.provider === "discord"
          ? { content: "🧪 JOE Forge test notification — integration is connected!" }
          : { text: "🧪 JOE Forge test notification — integration is connected!" };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      ok = response.ok;
      detail = response.ok
        ? `Test message delivered (HTTP ${response.status})`
        : `Webhook returned HTTP ${response.status}`;
    } catch (err: any) {
      detail = `Request failed: ${err?.message ?? "unknown error"}`;
    }

    // Log sync result
    await db.insert(integrationSyncLogsTable).values({
      integrationId: id,
      event: "announcement",
      status: ok ? "success" : "failed",
      detail,
    });

    res.json({ ok, detail });
  },
);

export default router;
