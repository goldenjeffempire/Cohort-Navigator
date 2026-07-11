import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";
import { coursesTable, modulesTable } from "./courses";
import { usersTable } from "./users";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const challengeDifficultyEnum = pgEnum("challenge_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const challengeTypeEnum = pgEnum("challenge_type", [
  "practice",
  "assessment",
  "capstone",
  "weekly",
]);

export const challengeSubmissionStatusEnum = pgEnum("challenge_submission_status", [
  "pending",
  "running",
  "passed",
  "partial",
  "failed",
  "error",
  "timeout",
]);

export const codingLanguageEnum = pgEnum("coding_language", [
  "javascript",
  "typescript",
  "python",
  "bash",
  "html",
  "css",
  "sql",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

/** A coding challenge that students can attempt */
export const codingChallengesTable = pgTable("coding_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions"),
  difficulty: challengeDifficultyEnum("difficulty").notNull().default("easy"),
  type: challengeTypeEnum("type").notNull().default("practice"),
  language: codingLanguageEnum("language").notNull(),
  starterCode: text("starter_code"),
  solutionCode: text("solution_code"), // staff-only, never sent to students
  courseId: integer("course_id").references(() => coursesTable.id, {
    onDelete: "set null",
  }),
  moduleId: integer("module_id").references(() => modulesTable.id, {
    onDelete: "set null",
  }),
  maxAttempts: integer("max_attempts"), // null = unlimited
  timeLimitMs: integer("time_limit_ms").notNull().default(10000),
  memoryLimitMb: integer("memory_limit_mb").notNull().default(128),
  isPublished: boolean("is_published").notNull().default(false),
  points: integer("points").notNull().default(100),
  tags: text("tags"), // comma-separated
  createdBy: integer("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Test cases for automatic grading */
export const challengeTestCasesTable = pgTable("challenge_test_cases", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => codingChallengesTable.id, { onDelete: "cascade" }),
  description: text("description"),
  input: text("input").notNull().default(""),
  expectedOutput: text("expected_output").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  points: integer("points").notNull().default(10),
  order: integer("order").notNull().default(0),
});

/** A student's code submission for a challenge */
export const challengeSubmissionsTable = pgTable("challenge_submissions", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => codingChallengesTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  language: codingLanguageEnum("language").notNull(),
  status: challengeSubmissionStatusEnum("status").notNull().default("pending"),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(100),
  passedTests: integer("passed_tests").notNull().default(0),
  totalTests: integer("total_tests").notNull().default(0),
  executionTimeMs: integer("execution_time_ms"),
  memoryUsedKb: integer("memory_used_kb"),
  feedback: text("feedback"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  overriddenBy: integer("overridden_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  overrideScore: integer("override_score"),
  overrideFeedback: text("override_feedback"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Per-test-case result for a submission */
export const submissionTestResultsTable = pgTable("submission_test_results", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => challengeSubmissionsTable.id, { onDelete: "cascade" }),
  testCaseId: integer("test_case_id")
    .notNull()
    .references(() => challengeTestCasesTable.id, { onDelete: "cascade" }),
  passed: boolean("passed").notNull().default(false),
  actualOutput: text("actual_output"),
  executionTimeMs: integer("execution_time_ms"),
  errorMessage: text("error_message"),
});

/** Logs of "Run Code" (non-submission) executions */
export const codeExecutionLogsTable = pgTable("code_execution_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  challengeId: integer("challenge_id").references(
    () => codingChallengesTable.id,
    { onDelete: "set null" },
  ),
  code: text("code").notNull(),
  language: codingLanguageEnum("language").notNull(),
  stdin: text("stdin"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  executionTimeMs: integer("execution_time_ms"),
  executedAt: timestamp("executed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Per-user coding activity streak */
export const codingStreaksTable = pgTable("coding_streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: text("last_activity_date"), // YYYY-MM-DD
  totalChallengesSolved: integer("total_challenges_solved").notNull().default(0),
  totalSubmissions: integer("total_submissions").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Pairwise plagiarism similarity report */
export const plagiarismReportsTable = pgTable("plagiarism_reports", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => codingChallengesTable.id, { onDelete: "cascade" }),
  submission1Id: integer("submission1_id")
    .notNull()
    .references(() => challengeSubmissionsTable.id, { onDelete: "cascade" }),
  submission2Id: integer("submission2_id")
    .notNull()
    .references(() => challengeSubmissionsTable.id, { onDelete: "cascade" }),
  similarityScore: real("similarity_score").notNull(),
  flagged: boolean("flagged").notNull().default(false),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type CodingChallenge = typeof codingChallengesTable.$inferSelect;
export type InsertCodingChallenge = typeof codingChallengesTable.$inferInsert;
export type ChallengeTestCase = typeof challengeTestCasesTable.$inferSelect;
export type InsertChallengeTestCase =
  typeof challengeTestCasesTable.$inferInsert;
export type ChallengeSubmission = typeof challengeSubmissionsTable.$inferSelect;
export type InsertChallengeSubmission =
  typeof challengeSubmissionsTable.$inferInsert;
export type SubmissionTestResult =
  typeof submissionTestResultsTable.$inferSelect;
export type CodeExecutionLog = typeof codeExecutionLogsTable.$inferSelect;
export type CodingStreak = typeof codingStreaksTable.$inferSelect;
export type PlagiarismReport = typeof plagiarismReportsTable.$inferSelect;
