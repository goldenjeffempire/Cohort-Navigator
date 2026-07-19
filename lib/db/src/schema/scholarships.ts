import { pgTable, text, serial, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

export const scholarshipStatusEnum = pgEnum("scholarship_status", [
  "draft",
  "pending",
  "under_review",
  "additional_info_requested",
  "probation",
  "probation_assessment",
  "fully_admitted",
  "not_admitted",
]);

export const scholarshipApplicationsTable = pgTable("scholarship_applications", {
  id: serial("id").primaryKey(),
  applicantUserId: integer("applicant_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "set null" }),

  // ── Personal Information ──────────────────────────────────────────────
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  state: text("state"),
  city: text("city"),
  address: text("address"),
  phone: text("phone"),
  emergencyContact: text("emergency_contact"),

  // ── Educational Background ────────────────────────────────────────────
  highestQualification: text("highest_qualification"),
  institution: text("institution"),
  courseOfStudy: text("course_of_study"),
  graduationYear: text("graduation_year"),

  // ── Professional Information ──────────────────────────────────────────
  employmentStatus: text("employment_status"),
  technicalExperience: text("technical_experience"),
  programmingExperience: text("programming_experience"),
  aiExperience: text("ai_experience"),
  previousProjects: text("previous_projects"),
  portfolioUrl: text("portfolio_url"),
  githubUrl: text("github_url"),
  linkedinUrl: text("linkedin_url"),
  resumeUrl: text("resume_url"),

  // ── Scholarship Information ───────────────────────────────────────────
  essay: text("essay"),
  careerGoals: text("career_goals"),
  motivationLetter: text("motivation_letter"),
  availability: text("availability"),
  hasInternetAccess: boolean("has_internet_access"),
  hasComputer: boolean("has_computer"),
  preferredTrack: text("preferred_track"),

  // ── Agreements ────────────────────────────────────────────────────────
  agreedToCodeOfConduct: boolean("agreed_to_code_of_conduct").default(false),
  agreedToScholarshipAgreement: boolean("agreed_to_scholarship_agreement").default(false),
  agreedToPrivacyPolicy: boolean("agreed_to_privacy_policy").default(false),
  agreedToTerms: boolean("agreed_to_terms").default(false),

  // ── Review / Admin ────────────────────────────────────────────────────
  status: scholarshipStatusEnum("status").notNull().default("pending"),
  reviewerId: integer("reviewer_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  score: integer("score"),

  // ── Probation / Assessment ────────────────────────────────────────────
  probationStartDate: timestamp("probation_start_date", { withTimezone: true }),
  probationEndDate: timestamp("probation_end_date", { withTimezone: true }),
  assessmentScore: integer("assessment_score"),
  assessmentCompletedAt: timestamp("assessment_completed_at", { withTimezone: true }),

  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertScholarshipApplicationSchema = createInsertSchema(scholarshipApplicationsTable).omit({
  id: true,
  appliedAt: true,
  reviewedAt: true,
});
export type InsertScholarshipApplication = z.infer<typeof insertScholarshipApplicationSchema>;
export type ScholarshipApplication = typeof scholarshipApplicationsTable.$inferSelect;
