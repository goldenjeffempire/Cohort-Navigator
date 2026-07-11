import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  lessonsTable,
  lessonResourcesTable,
  lessonProgressTable,
  lessonBookmarksTable,
  modulesTable,
  coursesTable,
} from "@workspace/db";
import {
  UpdateLessonBody,
  AddLessonResourceBody,
  SetLessonProgressBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { attachSingleLessonState } from "../lib/lessonState";

const router: IRouter = Router();

router.get("/lessons/continue-learning", requireAuth, async (req, res): Promise<void> => {
  const [recent] = await db
    .select()
    .from(lessonProgressTable)
    .where(and(eq(lessonProgressTable.studentId, req.user!.id), eq(lessonProgressTable.completed, false)))
    .orderBy(desc(lessonProgressTable.lastAccessedAt))
    .limit(1);

  if (!recent) {
    res.json({
      lessonId: null,
      lessonTitle: null,
      moduleId: null,
      courseId: null,
      courseTitle: null,
    });
    return;
  }

  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, recent.lessonId));
  if (!lesson) {
    res.json({ lessonId: null, lessonTitle: null, moduleId: null, courseId: null, courseTitle: null });
    return;
  }
  const [module_] = await db.select().from(modulesTable).where(eq(modulesTable.id, lesson.moduleId));
  const [course] = module_
    ? await db.select().from(coursesTable).where(eq(coursesTable.id, module_.courseId))
    : [undefined];

  res.json({
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    moduleId: module_?.id ?? null,
    courseId: course?.id ?? null,
    courseTitle: course?.title ?? null,
  });
});

router.get("/lessons/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, id));
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  await db
    .insert(lessonProgressTable)
    .values({ lessonId: id, studentId: req.user!.id, completed: false, lastAccessedAt: new Date() })
    .onConflictDoUpdate({
      target: [lessonProgressTable.lessonId, lessonProgressTable.studentId],
      set: { lastAccessedAt: new Date() },
    });
  res.json(await attachSingleLessonState(lesson, req.user!.id));
});

router.patch(
  "/lessons/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateLessonBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [lesson] = await db
      .update(lessonsTable)
      .set(parsed.data)
      .where(eq(lessonsTable.id, id))
      .returning();
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    res.json(await attachSingleLessonState(lesson, req.user!.id));
  },
);

router.delete(
  "/lessons/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(lessonsTable).where(eq(lessonsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/lessons/:id/resources", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const resources = await db
    .select()
    .from(lessonResourcesTable)
    .where(eq(lessonResourcesTable.lessonId, id));
  res.json(resources);
});

router.post(
  "/lessons/:id/resources",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = AddLessonResourceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [resource] = await db
      .insert(lessonResourcesTable)
      .values({ lessonId: id, ...parsed.data })
      .returning();
    res.status(201).json(resource);
  },
);

router.delete(
  "/lessons/:id/resources/:resourceId",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const resourceId = parseInt(String(req.params.resourceId), 10);
    if (Number.isNaN(resourceId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db
      .delete(lessonResourcesTable)
      .where(eq(lessonResourcesTable.id, resourceId))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.post("/lessons/:id/progress", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SetLessonProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const now = new Date();
  const [progress] = await db
    .insert(lessonProgressTable)
    .values({
      lessonId: id,
      studentId: req.user!.id,
      completed: parsed.data.completed,
      completedAt: parsed.data.completed ? now : null,
      lastAccessedAt: now,
    })
    .onConflictDoUpdate({
      target: [lessonProgressTable.lessonId, lessonProgressTable.studentId],
      set: {
        completed: parsed.data.completed,
        completedAt: parsed.data.completed ? now : null,
        lastAccessedAt: now,
      },
    })
    .returning();
  res.json(progress);
});

router.post("/lessons/:id/bookmark", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db
    .select()
    .from(lessonBookmarksTable)
    .where(and(eq(lessonBookmarksTable.lessonId, id), eq(lessonBookmarksTable.studentId, req.user!.id)));

  if (existing) {
    await db.delete(lessonBookmarksTable).where(eq(lessonBookmarksTable.id, existing.id));
    res.json({ lessonId: id, bookmarked: false });
    return;
  }
  await db.insert(lessonBookmarksTable).values({ lessonId: id, studentId: req.user!.id });
  res.json({ lessonId: id, bookmarked: true });
});

export default router;
