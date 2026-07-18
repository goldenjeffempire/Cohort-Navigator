import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  teamTasksTable,
  teamMembersTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// Helper: verify caller is a member of the team that owns a task
async function callerIsMemberOfTaskTeam(taskId: number, userId: number): Promise<{ task: typeof teamTasksTable.$inferSelect; ok: boolean }> {
  const [task] = await db.select().from(teamTasksTable).where(eq(teamTasksTable.id, taskId));
  if (!task) return { task: task as any, ok: false };
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, task.teamId), eq(teamMembersTable.userId, userId)));
  return { task, ok: !!membership };
}

// ─── GET /teams/:id/tasks ─────────────────────────────────────────────────────

router.get("/teams/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(teamId)) { res.status(400).json({ error: "Invalid team id" }); return; }

  const userId = req.user!.id;
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const tasks = await db.select().from(teamTasksTable).where(eq(teamTasksTable.teamId, teamId));
  res.json(tasks);
});

// ─── POST /teams/:id/tasks ────────────────────────────────────────────────────

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.number().int().optional(),
  dueDate: z.string().optional(),
});

router.post("/teams/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(teamId)) { res.status(400).json({ error: "Invalid team id" }); return; }

  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.user!.id;
  const [membership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const { title, description, assigneeId, dueDate } = parsed.data;
  const [task] = await db
    .insert(teamTasksTable)
    .values({
      teamId,
      title,
      description,
      assigneeId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    })
    .returning();

  res.status(201).json(task);
});

// ─── PATCH /teams/tasks/:id ───────────────────────────────────────────────────

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeId: z.number().int().optional(),
  dueDate: z.string().optional(),
});

router.patch("/teams/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(taskId)) { res.status(400).json({ error: "Invalid task id" }); return; }

  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.user!.id;
  const { task, ok } = await callerIsMemberOfTaskTeam(taskId, userId);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (!ok) { res.status(403).json({ error: "Forbidden" }); return; }

  const { dueDate, ...rest } = parsed.data;
  const [updated] = await db
    .update(teamTasksTable)
    .set({
      ...rest,
      ...(dueDate !== undefined ? { dueDate: new Date(dueDate) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(teamTasksTable.id, taskId))
    .returning();

  res.json(updated);
});

// ─── DELETE /teams/tasks/:id ──────────────────────────────────────────────────

router.delete("/teams/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(taskId)) { res.status(400).json({ error: "Invalid task id" }); return; }

  const userId = req.user!.id;
  const { task, ok } = await callerIsMemberOfTaskTeam(taskId, userId);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (!ok) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(teamTasksTable).where(eq(teamTasksTable.id, taskId));
  res.sendStatus(204);
});

export default router;
