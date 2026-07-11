import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  mentorAvailabilitySlotsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── GET /mentors/:userId/availability ────────────────────────────────────────

router.get("/mentors/:userId/availability", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const slots = await db
    .select()
    .from(mentorAvailabilitySlotsTable)
    .where(eq(mentorAvailabilitySlotsTable.mentorId, userId));

  res.json(slots);
});

// ─── PUT /mentors/me/availability ─────────────────────────────────────────────

const SlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0),
  endMinute: z.number().int().min(0),
});

const UpsertAvailabilityBody = z.object({
  slots: z.array(SlotSchema),
});

router.put(
  "/mentors/me/availability",
  requireAuth,
  requireRole("mentor", "admin"),
  async (req, res): Promise<void> => {
    const parsed = UpsertAvailabilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const mentorId = req.user!.id;

    const result = await db.transaction(async (tx) => {
      await tx
        .delete(mentorAvailabilitySlotsTable)
        .where(eq(mentorAvailabilitySlotsTable.mentorId, mentorId));

      if (parsed.data.slots.length === 0) {
        return [];
      }

      return tx
        .insert(mentorAvailabilitySlotsTable)
        .values(
          parsed.data.slots.map((slot) => ({
            mentorId,
            dayOfWeek: slot.dayOfWeek,
            startMinute: slot.startMinute,
            endMinute: slot.endMinute,
            isActive: true,
          })),
        )
        .returning();
    });

    res.json(result);
  },
);

export default router;
