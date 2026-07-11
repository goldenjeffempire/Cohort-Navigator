import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

export const sessionFormatEnum = pgEnum("mentoring_session_format", ["one_on_one", "group"]);
export const sessionStatusEnum = pgEnum("mentoring_session_status", ["scheduled", "completed", "cancelled", "no_show"]);

export const mentorProfilesTable = pgTable("mentor_profiles", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  headline: text("headline"), // e.g. "Senior Backend Engineer @ Acme"
  expertise: text("expertise"), // comma-separated tags, kept simple (no separate tags table)
  bio: text("bio"),
  timezone: text("timezone").notNull().default("UTC"),
  isAcceptingBookings: boolean("is_accepting_bookings").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMentorProfileSchema = createInsertSchema(mentorProfilesTable).omit({ updatedAt: true });
export type InsertMentorProfile = z.infer<typeof insertMentorProfileSchema>;
export type MentorProfile = typeof mentorProfilesTable.$inferSelect;

// Office-hours availability, expressed as recurring weekly slots
// (dayOfWeek 0-6) plus a duration — booking picks a concrete start time
// within an open slot and creates a mentoring_sessions row.
export const mentorAvailabilitySlotsTable = pgTable("mentor_availability_slots", {
  id: serial("id").primaryKey(),
  mentorId: integer("mentor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday .. 6 = Saturday
  startMinute: integer("start_minute").notNull(), // minutes from midnight, mentor's timezone
  endMinute: integer("end_minute").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertMentorAvailabilitySlotSchema = createInsertSchema(mentorAvailabilitySlotsTable).omit({ id: true });
export type InsertMentorAvailabilitySlot = z.infer<typeof insertMentorAvailabilitySlotSchema>;
export type MentorAvailabilitySlot = typeof mentorAvailabilitySlotsTable.$inferSelect;

export const mentoringSessionsTable = pgTable("mentoring_sessions", {
  id: serial("id").primaryKey(),
  mentorId: integer("mentor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").references(() => usersTable.id, { onDelete: "cascade" }), // null for group sessions (see participants)
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "set null" }),
  format: sessionFormatEnum("format").notNull().default("one_on_one"),
  status: sessionStatusEnum("status").notNull().default("scheduled"),
  topic: text("topic"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  meetingLink: text("meeting_link"),
  recordingUrl: text("recording_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMentoringSessionSchema = createInsertSchema(mentoringSessionsTable).omit({ id: true, createdAt: true });
export type InsertMentoringSession = z.infer<typeof insertMentoringSessionSchema>;
export type MentoringSession = typeof mentoringSessionsTable.$inferSelect;

// Additional attendees for group mentoring sessions.
export const mentoringSessionParticipantsTable = pgTable("mentoring_session_participants", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => mentoringSessionsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.sessionId, t.studentId)]);

export const insertMentoringSessionParticipantSchema = createInsertSchema(mentoringSessionParticipantsTable).omit({ id: true });
export type InsertMentoringSessionParticipant = z.infer<typeof insertMentoringSessionParticipantSchema>;
export type MentoringSessionParticipant = typeof mentoringSessionParticipantsTable.$inferSelect;

// Bidirectional feedback — mentor rates student, student rates mentor.
export const sessionFeedbackTable = pgTable("session_feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => mentoringSessionsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  authorRole: text("author_role").notNull(), // "mentor" | "student"
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.sessionId, t.authorId)]);

export const insertSessionFeedbackSchema = createInsertSchema(sessionFeedbackTable).omit({ id: true, createdAt: true });
export type InsertSessionFeedback = z.infer<typeof insertSessionFeedbackSchema>;
export type SessionFeedback = typeof sessionFeedbackTable.$inferSelect;
