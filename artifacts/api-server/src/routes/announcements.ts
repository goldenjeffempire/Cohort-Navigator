import { Router, type IRouter } from "express";
import { desc, eq, isNull, or } from "drizzle-orm";
import { db, announcementsTable, usersTable } from "@workspace/db";
import {
  ListAnnouncementsQueryParams,
  CreateAnnouncementBody,
  UpdateAnnouncementBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

async function withAuthorName(a: typeof announcementsTable.$inferSelect) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, a.authorId));
  return { ...a, authorName: author?.name ?? "" };
}

router.get("/announcements", requireAuth, async (req, res): Promise<void> => {
  const query = ListAnnouncementsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(
      query.data.cohortId
        ? or(eq(announcementsTable.cohortId, query.data.cohortId), isNull(announcementsTable.cohortId))
        : undefined,
    )
    .orderBy(desc(announcementsTable.createdAt));
  res.json(await Promise.all(rows.map(withAuthorName)));
});

router.post(
  "/announcements",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const parsed = CreateAnnouncementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [announcement] = await db
      .insert(announcementsTable)
      .values({ ...parsed.data, authorId: req.user!.id })
      .returning();
    res.status(201).json(await withAuthorName(announcement));
  },
);

router.get("/announcements/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [announcement] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id));
  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  res.json(await withAuthorName(announcement));
});

router.patch(
  "/announcements/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateAnnouncementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [announcement] = await db
      .update(announcementsTable)
      .set(parsed.data)
      .where(eq(announcementsTable.id, id))
      .returning();
    if (!announcement) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    res.json(await withAuthorName(announcement));
  },
);

router.delete(
  "/announcements/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(announcementsTable).where(eq(announcementsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
