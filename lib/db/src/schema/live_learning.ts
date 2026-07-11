import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

/**
 * Live Learning + Community Engagement events share one model: a
 * `live_sessions` row is a class, webinar, hackathon, coding competition, or
 * generic community event depending on `type`. Hackathons/competitions link
 * out to existing Phase 3 coding challenges (challengeIds) rather than
 * duplicating problem-authoring infrastructure.
 */
export const liveSessionTypeEnum = pgEnum("live_session_type", [
  "class", "webinar", "office_hours", "event", "hackathon", "competition",
]);
export const liveSessionStatusEnum = pgEnum("live_session_status", ["scheduled", "live", "completed", "cancelled"]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["going", "interested", "declined"]);

export const liveSessionsTable = pgTable("live_sessions", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "cascade" }), // null = open to all cohorts
  type: liveSessionTypeEnum("type").notNull().default("class"),
  status: liveSessionStatusEnum("status").notNull().default("scheduled"),
  title: text("title").notNull(),
  description: text("description"),
  hostId: integer("host_id").references(() => usersTable.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  meetingLink: text("meeting_link"),
  recordingUrl: text("recording_url"),
  // For hackathons/competitions: comma-separated coding_challenges IDs used as the problem set.
  relatedChallengeIds: text("related_challenge_ids"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLiveSessionSchema = createInsertSchema(liveSessionsTable).omit({ id: true, createdAt: true });
export type InsertLiveSession = z.infer<typeof insertLiveSessionSchema>;
export type LiveSession = typeof liveSessionsTable.$inferSelect;

export const liveSessionRsvpsTable = pgTable("live_session_rsvps", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: rsvpStatusEnum("status").notNull().default("going"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.sessionId, t.userId)]);

export const insertLiveSessionRsvpSchema = createInsertSchema(liveSessionRsvpsTable).omit({ id: true, createdAt: true });
export type InsertLiveSessionRsvp = z.infer<typeof insertLiveSessionRsvpSchema>;
export type LiveSessionRsvp = typeof liveSessionRsvpsTable.$inferSelect;

export const liveSessionAttendanceTable = pgTable("live_session_attendance", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => liveSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
}, (t) => [unique().on(t.sessionId, t.userId)]);

export const insertLiveSessionAttendanceSchema = createInsertSchema(liveSessionAttendanceTable).omit({ id: true, joinedAt: true });
export type InsertLiveSessionAttendance = z.infer<typeof insertLiveSessionAttendanceSchema>;
export type LiveSessionAttendance = typeof liveSessionAttendanceTable.$inferSelect;
