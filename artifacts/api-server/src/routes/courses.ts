import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, coursesTable, modulesTable, lessonsTable } from "@workspace/db";
import {
  CreateCourseBody,
  UpdateCourseBody,
  CreateModuleBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeCourse } from "../lib/serializers";

const router: IRouter = Router();

router.get("/courses", requireAuth, async (_req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.title);
  res.json(await Promise.all(courses.map(serializeCourse)));
});

router.post(
  "/courses",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateCourseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [course] = await db.insert(coursesTable).values(parsed.data).returning();
    res.status(201).json(await serializeCourse(course));
  },
);

router.get("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  res.json(await serializeCourse(course));
});

router.patch(
  "/courses/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateCourseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [course] = await db
      .update(coursesTable)
      .set(parsed.data)
      .where(eq(coursesTable.id, id))
      .returning();
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(await serializeCourse(course));
  },
);

router.delete(
  "/courses/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(coursesTable).where(eq(coursesTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/courses/:id/modules", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const modules = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.courseId, id))
    .orderBy(modulesTable.order);
  const withCounts = await Promise.all(
    modules.map(async (m) => {
      const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.moduleId, m.id));
      return { ...m, lessonCount: lessons.length };
    }),
  );
  res.json(withCounts);
});

router.post(
  "/courses/:id/modules",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = CreateModuleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [module_] = await db
      .insert(modulesTable)
      .values({ courseId: id, title: parsed.data.title, order: parsed.data.order ?? 0 })
      .returning();
    res.status(201).json({ ...module_, lessonCount: 0 });
  },
);

export default router;
