import { pgTable, text, serial, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { communitiesTable } from "./community";

export const reportTargetTypeEnum = pgEnum("report_target_type", ["discussion_thread", "discussion_post", "message", "user"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewing", "resolved", "dismissed"]);
export const communityAuditEventEnum = pgEnum("community_audit_event", [
  "thread_pinned", "thread_locked", "thread_deleted", "post_deleted",
  "member_suspended", "member_unsuspended", "role_changed",
  "report_resolved", "report_dismissed", "content_flagged_spam",
]);

export const contentReportsTable = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: reportTargetTypeEnum("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  status: reportStatusEnum("status").notNull().default("open"),
  resolvedById: integer("resolved_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertContentReportSchema = createInsertSchema(contentReportsTable).omit({ id: true, createdAt: true, resolvedAt: true, status: true, resolvedById: true, resolutionNote: true });
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;
export type ContentReport = typeof contentReportsTable.$inferSelect;

// Platform-wide suspension (distinct from per-community isSuspended flag,
// which only mutes a member in one community — this blocks all community
// features entirely, e.g. for spam/abuse).
export const userSuspensionsTable = pgTable("user_suspensions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  suspendedById: integer("suspended_by_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = indefinite
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSuspensionSchema = createInsertSchema(userSuspensionsTable).omit({ id: true, createdAt: true, liftedAt: true });
export type InsertUserSuspension = z.infer<typeof insertUserSuspensionSchema>;
export type UserSuspension = typeof userSuspensionsTable.$inferSelect;

export const communityAuditLogsTable = pgTable("community_audit_logs", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").references(() => communitiesTable.id, { onDelete: "set null" }),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  event: communityAuditEventEnum("event").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunityAuditLogSchema = createInsertSchema(communityAuditLogsTable).omit({ id: true, createdAt: true });
export type InsertCommunityAuditLog = z.infer<typeof insertCommunityAuditLogSchema>;
export type CommunityAuditLog = typeof communityAuditLogsTable.$inferSelect;
