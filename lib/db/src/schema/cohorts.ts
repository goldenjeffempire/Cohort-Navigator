import { pgTable, text, serial, timestamp, date, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

export const cohortStatusEnum = pgEnum("cohort_status", ["upcoming", "active", "completed"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "graduated", "dropped"]);

export const cohortsTable = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  status: cohortStatusEnum("status").notNull().default("upcoming"),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCohortSchema = createInsertSchema(cohortsTable).omit({ id: true, createdAt: true });
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type Cohort = typeof cohortsTable.$inferSelect;

export const cohortEnrollmentsTable = pgTable("cohort_enrollments", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohortsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: enrollmentStatusEnum("status").notNull().default("active"),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.cohortId, t.studentId)]);

export const insertCohortEnrollmentSchema = createInsertSchema(cohortEnrollmentsTable).omit({ id: true, enrolledAt: true });
export type InsertCohortEnrollment = z.infer<typeof insertCohortEnrollmentSchema>;
export type CohortEnrollment = typeof cohortEnrollmentsTable.$inferSelect;

export const mentorCohortsTable = pgTable("mentor_cohorts", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohortsTable.id, { onDelete: "cascade" }),
  mentorId: integer("mentor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.cohortId, t.mentorId)]);

export const insertMentorCohortSchema = createInsertSchema(mentorCohortsTable).omit({ id: true, assignedAt: true });
export type InsertMentorCohort = z.infer<typeof insertMentorCohortSchema>;
export type MentorCohort = typeof mentorCohortsTable.$inferSelect;

export const cohortCoursesTable = pgTable("cohort_courses", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohortsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.cohortId, t.courseId)]);

export const insertCohortCourseSchema = createInsertSchema(cohortCoursesTable).omit({ id: true, addedAt: true });
export type InsertCohortCourse = z.infer<typeof insertCohortCourseSchema>;
export type CohortCourse = typeof cohortCoursesTable.$inferSelect;
