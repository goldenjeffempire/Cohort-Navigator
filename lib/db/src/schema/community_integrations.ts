import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

/**
 * Admin-configured Discord/Slack integration per cohort (or platform-wide
 * when cohortId is null). Credentials themselves are never stored here —
 * they live in Replit Connectors (see lib/community-integrations/). This
 * table only holds the *mapping* (which guild/workspace + channel goes with
 * which cohort/community feature) and enabled/disabled state, so an admin
 * can turn Discord, Slack, or both on/off independently per organization
 * preference.
 */
export const integrationProviderEnum = pgEnum("integration_provider", ["discord", "slack"]);
export const integrationSyncEventEnum = pgEnum("integration_sync_event", [
  "announcement", "assignment_notification", "event_reminder", "live_session_reminder",
  "mentor_announcement", "channel_created", "member_invited", "role_synced",
]);
export const integrationSyncStatusEnum = pgEnum("integration_sync_status", ["success", "failed"]);

export const communityIntegrationsTable = pgTable("community_integrations", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "cascade" }), // null = platform-wide default
  provider: integrationProviderEnum("provider").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  // Discord: guildId + a map of {announcements, assignments, general} -> channelId.
  // Slack:   workspace team ID + a map of {announcements, assignments, general} -> channel ID.
  externalWorkspaceId: text("external_workspace_id"), // Discord guild ID / Slack team ID
  channelMap: jsonb("channel_map").$type<Record<string, string>>(),
  syncAnnouncements: boolean("sync_announcements").notNull().default(true),
  syncAssignments: boolean("sync_assignments").notNull().default(true),
  syncEventReminders: boolean("sync_event_reminders").notNull().default(true),
  configuredById: integer("configured_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.cohortId, t.provider)]);

export const insertCommunityIntegrationSchema = createInsertSchema(communityIntegrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommunityIntegration = z.infer<typeof insertCommunityIntegrationSchema>;
export type CommunityIntegration = typeof communityIntegrationsTable.$inferSelect;

export const integrationSyncLogsTable = pgTable("integration_sync_logs", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => communityIntegrationsTable.id, { onDelete: "cascade" }),
  event: integrationSyncEventEnum("event").notNull(),
  status: integrationSyncStatusEnum("status").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogsTable).omit({ id: true, createdAt: true });
export type InsertIntegrationSyncLog = z.infer<typeof insertIntegrationSyncLogSchema>;
export type IntegrationSyncLog = typeof integrationSyncLogsTable.$inferSelect;
