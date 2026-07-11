import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cohortsTable } from "./cohorts";
import { teamsTable } from "./teams";

/**
 * Real-time messaging. `conversations` unifies DMs, ad-hoc group chats,
 * cohort-wide chat rooms, and team project chats behind one model so the
 * WebSocket layer (see artifacts/api-server/src/realtime/) only needs to
 * know about one "room" concept. `kind` distinguishes them for UI purposes
 * and access rules (e.g. a `cohort_room` auto-includes every cohort member).
 */
export const conversationKindEnum = pgEnum("conversation_kind", ["dm", "group", "cohort_room", "team_room"]);
export const presenceStatusEnum = pgEnum("presence_status", ["online", "away", "offline"]);

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  kind: conversationKindEnum("kind").notNull().default("dm"),
  title: text("title"), // group chats may be named; null for 1:1 DMs
  cohortId: integer("cohort_id").references(() => cohortsTable.id, { onDelete: "cascade" }), // set for cohort_room
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "cascade" }), // set for team_room
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.cohortId), unique().on(t.teamId)]);

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;

export const conversationParticipantsTable = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  isMuted: boolean("is_muted").notNull().default(false),
  lastReadMessageId: integer("last_read_message_id"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.userId)]);

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipantsTable).omit({ id: true, joinedAt: true });
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;
export type ConversationParticipant = typeof conversationParticipantsTable.$inferSelect;

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  attachmentObjectPath: text("attachment_object_path"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, isDeleted: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

// Per-user read-receipt watermark, separate from lastReadMessageId above so
// multiple devices / the WS layer can write it independently of the REST
// participant record without racing on a single column's semantics.
export const messageReadsTable = pgTable("message_reads", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lastReadMessageId: integer("last_read_message_id"),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.userId)]);

export const insertMessageReadSchema = createInsertSchema(messageReadsTable).omit({ id: true, readAt: true });
export type InsertMessageRead = z.infer<typeof insertMessageReadSchema>;
export type MessageRead = typeof messageReadsTable.$inferSelect;

// Presence (online/offline/away) — updated by the WebSocket layer on
// connect/disconnect/heartbeat. Typing indicators are transient (broadcast
// over the socket directly, never persisted).
export const userPresenceTable = pgTable("user_presence", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  status: presenceStatusEnum("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserPresenceSchema = createInsertSchema(userPresenceTable);
export type InsertUserPresence = z.infer<typeof insertUserPresenceSchema>;
export type UserPresence = typeof userPresenceTable.$inferSelect;
