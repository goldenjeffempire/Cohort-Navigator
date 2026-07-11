import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, modulesTable, lessonsTable } from "@workspace/db";
import { UpdateModuleBody, CreateLessonBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { attachLessonState } from "../lib/lessonState";

const router: IRouter = Router();

async function withLessonCount(module_: typeof modulesTable.$inferSelect) {
  const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.moduleId, module_.id));
  return { ...module_, lessonCount: lessons.length };
}

router.get("/modules/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [module_] = await db.select().from(modulesTable).where(eq(modulesTable.id, id));
  if (!module_) {
    res.status(404).json({ error: "Module not found" });
    return;
  }
  res.json(await withLessonCount(module_));
});

router.patch(
  "/modules/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateModuleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [module_] = await db
      .update(modulesTable)
      .set(parsed.data)
      .where(eq(modulesTable.id, id))
      .returning();
    if (!module_) {
      res.status(404).json({ error: "Module not found" });
      return;
    }
    res.json(await withLessonCount(module_));
  },
);

router.delete(
  "/modules/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(modulesTable).where(eq(modulesTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Module not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/modules/:id/lessons", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const lessons = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.moduleId, id))
    .orderBy(lessonsTable.order);
  res.json(await attachLessonState(lessons, req.user!.id));
});

router.post(
  "/modules/:id/lessons",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = CreateLessonBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [lesson] = await db
      .insert(lessonsTable)
      .values({ moduleId: id, ...parsed.data })
      .returning();
    res.status(201).json({ ...lesson, completed: false, bookmarked: false });
  },
);

export default router;
