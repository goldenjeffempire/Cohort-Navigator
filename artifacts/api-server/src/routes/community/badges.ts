/**
 * Badges + user badge routes
 *
 * GET  /badges
 * POST /badges
 * GET  /users/:userId/badges
 * POST /users/:userId/badges
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  badgesTable,
  userBadgesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── List all badges ──────────────────────────────────────────────────────────

router.get("/badges", requireAuth, async (_req, res): Promise<void> => {
  const badges = await db.select().from(badgesTable);
  res.json(badges);
});

// ─── Create badge ─────────────────────────────────────────────────────────────

const CreateBadgeBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().optional(),
  category: z.enum(["participation", "achievement", "mentorship", "leadership", "event"]).optional(),
});

router.post(
  "/badges",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateBadgeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [badge] = await db
      .insert(badgesTable)
      .values(parsed.data)
      .returning();

    res.status(201).json(badge);
  },
);

// ─── List user's earned badges ────────────────────────────────────────────────

router.get("/users/:userId/badges", requireAuth, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userBadges = await db
    .select({
      id: userBadgesTable.id,
      userId: userBadgesTable.userId,
      badgeId: userBadgesTable.badgeId,
      awardedReason: userBadgesTable.awardedReason,
      awardedAt: userBadgesTable.awardedAt,
      badge: {
        id: badgesTable.id,
        name: badgesTable.name,
        description: badgesTable.description,
        icon: badgesTable.icon,
        category: badgesTable.category,
        createdAt: badgesTable.createdAt,
      },
    })
    .from(userBadgesTable)
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(eq(userBadgesTable.userId, userId));

  res.json(userBadges);
});

// ─── Award badge to user ──────────────────────────────────────────────────────

const AwardBadgeBody = z.object({
  badgeId: z.number().int(),
  awardedReason: z.string().optional(),
});

router.post(
  "/users/:userId/badges",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const userId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(userId)) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const parsed = AwardBadgeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Idempotent on (userId, badgeId) — return existing if already awarded
    const [existing] = await db
      .select()
      .from(userBadgesTable)
      .where(
        and(
          eq(userBadgesTable.userId, userId),
          eq(userBadgesTable.badgeId, parsed.data.badgeId),
        ),
      );

    if (existing) {
      res.json(existing);
      return;
    }

    const [userBadge] = await db
      .insert(userBadgesTable)
      .values({ userId, badgeId: parsed.data.badgeId, awardedReason: parsed.data.awardedReason })
      .returning();

    res.status(201).json(userBadge);
  },
);

export default router;
