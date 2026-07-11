import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";

/**
 * Communities are the top-level collaboration space. Every cohort gets its
 * own community automatically (see routes/community/index.ts); there is
 * also exactly one `kind: "global"` community shared by everyone (the JOE
 * Hub-wide space for general/AI discussions, hackathons, etc).
 */
export const communityKindEnum = pgEnum("community_kind", ["global", "cohort"]);
export const communityMemberRoleEnum = pgEnum("community_member_role", ["member", "moderator", "admin"]);
export const badgeCategoryEnum = pgEnum("badge_category", ["participation", "achievement", "mentorship", "leadership", "event"]);

export const communitiesTable = pgTable("communities", {
  id: serial("id").primaryKey(),
  kind: communityKindEnum("kind").notNull().default("cohort"),
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  guidelines: text("guidelines"), // markdown — community guidelines/code of conduct
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.cohortId)]);

export const insertCommunitySchema = createInsertSchema(communitiesTable).omit({ id: true, createdAt: true });
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type Community = typeof communitiesTable.$inferSelect;

// Membership + per-community role (moderator is scoped to a single
// community, distinct from the global user_role which governs platform-wide
// admin/mentor/student permissions).
export const communityMembersTable = pgTable("community_members", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: communityMemberRoleEnum("role").notNull().default("member"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.communityId, t.userId)]);

export const insertCommunityMemberSchema = createInsertSchema(communityMembersTable).omit({ id: true, joinedAt: true });
export type InsertCommunityMember = z.infer<typeof insertCommunityMemberSchema>;
export type CommunityMember = typeof communityMembersTable.$inferSelect;

// ─── Recognition badges (community engagement) ────────────────────────────────

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("award"), // lucide-react icon name
  category: badgeCategoryEnum("category").notNull().default("participation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBadgeSchema = createInsertSchema(badgesTable).omit({ id: true, createdAt: true });
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badgesTable.$inferSelect;

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badgesTable.id, { onDelete: "cascade" }),
  awardedReason: text("awarded_reason"),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.badgeId)]);

export const insertUserBadgeSchema = createInsertSchema(userBadgesTable).omit({ id: true, awardedAt: true });
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadgesTable.$inferSelect;
