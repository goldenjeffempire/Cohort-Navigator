/**
 * Team shared resources
 *
 * GET    /teams/:id/resources                    — list resources
 * POST   /teams/:id/resources                    — add resource
 * DELETE /teams/:id/resources/:resourceId        — remove resource
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, teamResourcesTable, teamMembersTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

async function isTeamMember(teamId: number, userId: number) {
  const [m] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)))
    .limit(1);
  return m ?? null;
}

router.get("/teams/:id/resources", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const user = req.user!;
  if (user.role !== "admin") {
    const m = await isTeamMember(id, user.id);
    if (!m) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const resources = await db
    .select()
    .from(teamResourcesTable)
    .where(eq(teamResourcesTable.teamId, id));

  res.json(resources);
});

const CreateResourceBody = z.object({
  title: z.string().min(1),
  url: z.string().optional(),
  objectPath: z.string().optional(),
});

router.post("/teams/:id/resources", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CreateResourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const user = req.user!;
  if (user.role !== "admin") {
    const m = await isTeamMember(id, user.id);
    if (!m) { res.status(403).json({ error: "Forbidden — not a team member" }); return; }
  }

  const [resource] = await db
    .insert(teamResourcesTable)
    .values({ teamId: id, addedById: user.id, ...parsed.data })
    .returning();

  res.status(201).json(resource);
});

router.delete("/teams/:id/resources/:resourceId", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  const resourceId = parseInt(String(req.params.resourceId), 10);
  if (Number.isNaN(teamId) || Number.isNaN(resourceId)) {
    res.status(400).json({ error: "Invalid id" }); return;
  }

  const user = req.user!;
  if (user.role !== "admin") {
    const m = await isTeamMember(teamId, user.id);
    if (!m || m.role !== "lead") { res.status(403).json({ error: "Forbidden — team lead only" }); return; }
  }

  const [deleted] = await db
    .delete(teamResourcesTable)
    .where(and(eq(teamResourcesTable.id, resourceId), eq(teamResourcesTable.teamId, teamId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Resource not found" }); return; }
  res.sendStatus(204);
});

export default router;
