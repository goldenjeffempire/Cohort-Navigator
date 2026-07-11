import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

export const scholarshipStatusEnum = pgEnum("scholarship_status", ["pending", "approved", "rejected"]);

export const scholarshipApplicationsTable = pgTable("scholarship_applications", {
  id: serial("id").primaryKey(),
  applicantUserId: integer("applicant_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  essay: text("essay").notNull(),
  status: scholarshipStatusEnum("status").notNull().default("pending"),
  reviewerId: integer("reviewer_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertScholarshipApplicationSchema = createInsertSchema(scholarshipApplicationsTable).omit({ id: true, appliedAt: true, reviewedAt: true });
export type InsertScholarshipApplication = z.infer<typeof insertScholarshipApplicationSchema>;
export type ScholarshipApplication = typeof scholarshipApplicationsTable.$inferSelect;
