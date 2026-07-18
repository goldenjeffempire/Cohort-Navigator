import { Router } from "express";
import { eq, and, isNull, or, gt } from "drizzle-orm";
import { z } from "zod";
import { db, userSuspensionsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── POST /suspensions ────────────────────────────────────────────────────────

const CreateSuspensionBody = z.object({
  userId: z.number().int(),
  reason: z.string().min(3),
  expiresAt: z.string().optional(), // ISO datetime string
});

router.post(
  "/suspensions",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateSuspensionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    const [suspension] = await db
      .insert(userSuspensionsTable)
      .values({
        userId: parsed.data.userId,
        reason: parsed.data.reason,
        suspendedById: req.user!.id,
        expiresAt: expiresAt ?? undefined,
      })
      .returning();

    res.status(201).json(suspension);
  },
);

// ─── GET /suspensions ─────────────────────────────────────────────────────────

const ListSuspensionsQuery = z.object({
  active: z.string().optional(),
});

router.get(
  "/suspensions",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = ListSuspensionsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const now = new Date();
    let whereClause;
    if (parsed.data.active === "true") {
      // active = liftedAt is null AND (expiresAt is null OR expiresAt > now)
      whereClause = and(
        isNull(userSuspensionsTable.liftedAt),
        or(
          isNull(userSuspensionsTable.expiresAt),
          gt(userSuspensionsTable.expiresAt, now),
        ),
      );
    }

    const rows = await db
      .select()
      .from(userSuspensionsTable)
      .where(whereClause)
      .orderBy(userSuspensionsTable.createdAt);

    res.json(rows);
  },
);

// ─── POST /suspensions/:id/lift ───────────────────────────────────────────────

router.post(
  "/suspensions/:id/lift",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [suspension] = await db
      .update(userSuspensionsTable)
      .set({ liftedAt: new Date() })
      .where(eq(userSuspensionsTable.id, id))
      .returning();

    if (!suspension) {
      res.status(404).json({ error: "Suspension not found" });
      return;
    }

    res.json(suspension);
  },
);

// ─── GET /users/:userId/suspension-status ────────────────────────────────────

router.get(
  "/users/:userId/suspension-status",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(userId)) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const now = new Date();
    const [suspension] = await db
      .select()
      .from(userSuspensionsTable)
      .where(
        and(
          eq(userSuspensionsTable.userId, userId),
          isNull(userSuspensionsTable.liftedAt),
          or(
            isNull(userSuspensionsTable.expiresAt),
            gt(userSuspensionsTable.expiresAt, now),
          ),
        ),
      )
      .limit(1);

    if (suspension) {
      res.json({ isSuspended: true, suspension });
    } else {
      res.json({ isSuspended: false });
    }
  },
);

export default router;
