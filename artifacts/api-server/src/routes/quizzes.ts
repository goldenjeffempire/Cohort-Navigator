import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  quizzesTable,
  quizQuestionsTable,
  quizOptionsTable,
  quizAttemptsTable,
  quizAnswersTable,
} from "@workspace/db";
import {
  ListQuizzesQueryParams,
  CreateQuizBody,
  UpdateQuizBody,
  CreateQuestionBody,
  UpdateQuestionBody,
  SubmitAnswerBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeQuiz } from "../lib/serializers";

const router: IRouter = Router();

async function loadQuestionWithOptions(questionId: number) {
  const [question] = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.id, questionId));
  const options = await db
    .select()
    .from(quizOptionsTable)
    .where(eq(quizOptionsTable.questionId, questionId))
    .orderBy(quizOptionsTable.order);
  return { ...question, options };
}

router.get("/quizzes", requireAuth, async (req, res): Promise<void> => {
  const query = ListQuizzesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const quizzes = await db
    .select()
    .from(quizzesTable)
    .where(query.data.courseId ? eq(quizzesTable.courseId, query.data.courseId) : undefined)
    .orderBy(quizzesTable.title);
  res.json(await Promise.all(quizzes.map(serializeQuiz)));
});

router.post(
  "/quizzes",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const parsed = CreateQuizBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [quiz] = await db.insert(quizzesTable).values(parsed.data).returning();
    res.status(201).json(await serializeQuiz(quiz));
  },
);

router.get("/quizzes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }
  res.json(await serializeQuiz(quiz));
});

router.patch(
  "/quizzes/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateQuizBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [quiz] = await db.update(quizzesTable).set(parsed.data).where(eq(quizzesTable.id, id)).returning();
    if (!quiz) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }
    res.json(await serializeQuiz(quiz));
  },
);

router.delete(
  "/quizzes/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(quizzesTable).where(eq(quizzesTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/quizzes/:id/questions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const questions = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.quizId, id))
    .orderBy(quizQuestionsTable.order);
  const withOptions = await Promise.all(questions.map((q) => loadQuestionWithOptions(q.id)));
  res.json(withOptions);
});

router.post(
  "/quizzes/:id/questions",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = CreateQuestionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [question] = await db
      .insert(quizQuestionsTable)
      .values({ quizId: id, question: parsed.data.question, order: parsed.data.order ?? 0 })
      .returning();
    const options = await db
      .insert(quizOptionsTable)
      .values(parsed.data.options.map((o) => ({ questionId: question.id, ...o })))
      .returning();
    res.status(201).json({ ...question, options });
  },
);

router.patch(
  "/questions/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateQuestionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { options, ...rest } = parsed.data;
    const [question] = await db
      .update(quizQuestionsTable)
      .set(rest)
      .where(eq(quizQuestionsTable.id, id))
      .returning();
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    let finalOptions = await db
      .select()
      .from(quizOptionsTable)
      .where(eq(quizOptionsTable.questionId, id))
      .orderBy(quizOptionsTable.order);
    if (options) {
      await db.delete(quizOptionsTable).where(eq(quizOptionsTable.questionId, id));
      finalOptions = await db
        .insert(quizOptionsTable)
        .values(options.map((o) => ({ questionId: id, ...o })))
        .returning();
    }
    res.json({ ...question, options: finalOptions });
  },
);

router.delete(
  "/questions/:id",
  requireAuth,
  requireRole("admin", "mentor"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(quizQuestionsTable).where(eq(quizQuestionsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.post("/quizzes/:id/attempts", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const questions = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id));
  const [attempt] = await db
    .insert(quizAttemptsTable)
    .values({ quizId: id, studentId: req.user!.id, totalQuestions: questions.length, status: "in_progress" })
    .returning();
  res.status(201).json({ ...attempt, answers: [] });
});

router.get("/quizzes/:id/attempts/me", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const attempts = await db
    .select()
    .from(quizAttemptsTable)
    .where(and(eq(quizAttemptsTable.quizId, id), eq(quizAttemptsTable.studentId, req.user!.id)));
  const withAnswers = await Promise.all(
    attempts.map(async (a) => ({
      ...a,
      answers: await db.select().from(quizAnswersTable).where(eq(quizAnswersTable.attemptId, a.id)),
    })),
  );
  res.json(withAnswers);
});

router.get("/attempts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [attempt] = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.id, id));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  const answers = await db.select().from(quizAnswersTable).where(eq(quizAnswersTable.attemptId, id));
  res.json({ ...attempt, answers });
});

router.post("/attempts/:id/answers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [option] = await db
    .select()
    .from(quizOptionsTable)
    .where(eq(quizOptionsTable.id, parsed.data.selectedOptionId));
  const isCorrect = option?.isCorrect ?? false;

  const [existing] = await db
    .select()
    .from(quizAnswersTable)
    .where(and(eq(quizAnswersTable.attemptId, id), eq(quizAnswersTable.questionId, parsed.data.questionId)));

  if (existing) {
    const [updated] = await db
      .update(quizAnswersTable)
      .set({ selectedOptionId: parsed.data.selectedOptionId, isCorrect })
      .where(eq(quizAnswersTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [answer] = await db
    .insert(quizAnswersTable)
    .values({ attemptId: id, questionId: parsed.data.questionId, selectedOptionId: parsed.data.selectedOptionId, isCorrect })
    .returning();
  res.json(answer);
});

router.post("/attempts/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const answers = await db.select().from(quizAnswersTable).where(eq(quizAnswersTable.attemptId, id));
  const score = answers.filter((a) => a.isCorrect).length;
  const [attempt] = await db
    .update(quizAttemptsTable)
    .set({ score, status: "completed", submittedAt: new Date() })
    .where(eq(quizAttemptsTable.id, id))
    .returning();
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  res.json({ ...attempt, answers });
});

export default router;
