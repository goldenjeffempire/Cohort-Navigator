import { pgTable, text, serial, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable, modulesTable } from "./courses";
import { usersTable } from "./users";

export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "completed"]);

export const quizzesTable = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  moduleId: integer("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  timeLimitMinutes: integer("time_limit_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuizSchema = createInsertSchema(quizzesTable).omit({ id: true, createdAt: true });
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzesTable.$inferSelect;

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  order: integer("order").notNull().default(0),
});

export const insertQuizQuestionSchema = createInsertSchema(quizQuestionsTable).omit({ id: true });
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;

export const quizOptionsTable = pgTable("quiz_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => quizQuestionsTable.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  order: integer("order").notNull().default(0),
});

export const insertQuizOptionSchema = createInsertSchema(quizOptionsTable).omit({ id: true });
export type InsertQuizOption = z.infer<typeof insertQuizOptionSchema>;
export type QuizOption = typeof quizOptionsTable.$inferSelect;

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  score: integer("score"),
  totalQuestions: integer("total_questions").notNull().default(0),
  status: attemptStatusEnum("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttemptsTable).omit({ id: true, startedAt: true });
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;

export const quizAnswersTable = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => quizAttemptsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => quizQuestionsTable.id, { onDelete: "cascade" }),
  selectedOptionId: integer("selected_option_id").notNull().references(() => quizOptionsTable.id, { onDelete: "cascade" }),
  isCorrect: boolean("is_correct").notNull().default(false),
});

export const insertQuizAnswerSchema = createInsertSchema(quizAnswersTable).omit({ id: true });
export type InsertQuizAnswer = z.infer<typeof insertQuizAnswerSchema>;
export type QuizAnswer = typeof quizAnswersTable.$inferSelect;
