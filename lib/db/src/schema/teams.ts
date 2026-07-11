import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

/**
 * Teams cover both "Team Collaboration" (project teams) and "Study groups"
 * (Community Engagement) — same shape (members, tasks, shared resources),
 * distinguished by `kind` so the UI can present them differently without a
 * second parallel schema.
 */
export const teamKindEnum = pgEnum("team_kind", ["project", "study_group"]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["lead", "member"]);
export const teamTaskStatusEnum = pgEnum("team_task_status", ["todo", "in_progress", "done"]);

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohortsTable.id, { onDelete: "cascade" }),
  kind: teamKindEnum("kind").notNull().default("project"),
  name: text("name").notNull(),
  description: text("description"),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: teamMemberRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.teamId, t.userId)]);

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable).omit({ id: true, joinedAt: true });
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembersTable.$inferSelect;

// Invitations — a pending member added by email/user before they accept.
export const teamInvitationsTable = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  invitedUserId: integer("invited_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  invitedById: integer("invited_by_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending | accepted | declined
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.teamId, t.invitedUserId)]);

export const insertTeamInvitationSchema = createInsertSchema(teamInvitationsTable).omit({ id: true, createdAt: true });
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitationsTable.$inferSelect;

export const teamTasksTable = pgTable("team_tasks", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: teamTaskStatusEnum("status").notNull().default("todo"),
  assigneeId: integer("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamTaskSchema = createInsertSchema(teamTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeamTask = z.infer<typeof insertTeamTaskSchema>;
export type TeamTask = typeof teamTasksTable.$inferSelect;

// Shared resources — links and/or uploaded files (object storage path).
export const teamResourcesTable = pgTable("team_resources", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  addedById: integer("added_by_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  url: text("url"), // external link
  objectPath: text("object_path"), // OR an uploaded file
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamResourceSchema = createInsertSchema(teamResourcesTable).omit({ id: true, createdAt: true });
export type InsertTeamResource = z.infer<typeof insertTeamResourceSchema>;
export type TeamResource = typeof teamResourcesTable.$inferSelect;
