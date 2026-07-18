/**
 * User presence
 *
 * GET  /presence   — fetch presence for a list of userIds
 * PUT  /presence   — update own presence status
 */
import { Router } from "express";
import { inArray, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, userPresenceTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

router.get("/presence", requireAuth, async (req, res): Promise<void> => {
  const raw = String(req.query.userIds ?? "");
  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));

  if (ids.length === 0) {
    res.json([]);
    return;
  }

  const rows = await db
    .select()
    .from(userPresenceTable)
    .where(inArray(userPresenceTable.userId, ids));

  res.json(rows);
});

const PresenceBody = z.object({
  status: z.enum(["online", "away", "offline"]),
});

router.put("/presence", requireAuth, async (req, res): Promise<void> => {
  const parsed = PresenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;

  const [row] = await db
    .insert(userPresenceTable)
    .values({ userId, status: parsed.data.status, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: userPresenceTable.userId,
      set: { status: parsed.data.status, lastSeenAt: new Date() },
    })
    .returning();

  res.json(row);
});

export default router;
