import { Router } from "express";
import { eq, ilike, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  mentorProfilesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── GET /mentors ─────────────────────────────────────────────────────────────

router.get("/mentors", async (req, res): Promise<void> => {
  const expertise = req.query.expertise ? String(req.query.expertise) : undefined;

  const conditions = [eq(mentorProfilesTable.isAcceptingBookings, true)];
  if (expertise) {
    conditions.push(ilike(mentorProfilesTable.expertise, `%${expertise}%`));
  }

  const rows = await db
    .select({
      userId: mentorProfilesTable.userId,
      headline: mentorProfilesTable.headline,
      expertise: mentorProfilesTable.expertise,
      bio: mentorProfilesTable.bio,
      timezone: mentorProfilesTable.timezone,
      isAcceptingBookings: mentorProfilesTable.isAcceptingBookings,
      updatedAt: mentorProfilesTable.updatedAt,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
      userBio: usersTable.bio,
    })
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(mentorProfilesTable.userId, usersTable.id))
    .where(and(...conditions));

  res.json(rows);
});

// ─── GET /mentors/:userId ─────────────────────────────────────────────────────

router.get("/mentors/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const [row] = await db
    .select({
      userId: mentorProfilesTable.userId,
      headline: mentorProfilesTable.headline,
      expertise: mentorProfilesTable.expertise,
      bio: mentorProfilesTable.bio,
      timezone: mentorProfilesTable.timezone,
      isAcceptingBookings: mentorProfilesTable.isAcceptingBookings,
      updatedAt: mentorProfilesTable.updatedAt,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
      userBio: usersTable.bio,
    })
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(mentorProfilesTable.userId, usersTable.id))
    .where(eq(mentorProfilesTable.userId, userId));

  if (!row) {
    res.status(404).json({ error: "Mentor profile not found" });
    return;
  }

  res.json(row);
});

// ─── PUT /mentors/me ──────────────────────────────────────────────────────────

const UpsertMentorProfileBody = z.object({
  headline: z.string().optional(),
  expertise: z.string().optional(),
  bio: z.string().optional(),
  timezone: z.string().optional(),
  isAcceptingBookings: z.boolean().optional(),
});

router.put(
  "/mentors/me",
  requireAuth,
  requireRole("mentor", "admin"),
  async (req, res): Promise<void> => {
    const parsed = UpsertMentorProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = req.user!.id;
    const values = { ...parsed.data, userId, updatedAt: new Date() };

    const [profile] = await db
      .insert(mentorProfilesTable)
      .values(values)
      .onConflictDoUpdate({
        target: mentorProfilesTable.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();

    res.json(profile);
  },
);

export default router;
