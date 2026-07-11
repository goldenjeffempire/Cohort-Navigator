import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { communitiesTable } from "./community";

/**
 * Threaded discussions. A thread always belongs to a community (cohort or
 * global) and a category; it may optionally be scoped to a specific
 * course/lesson/assignment/challenge/team via the nullable context columns
 * below so "Course discussions", "Lesson discussions", "Assignment
 * discussions", "Project discussions" etc. are all the same underlying
 * model, just filtered/linked differently in the UI.
 */
export const discussionCategoryEnum = pgEnum("discussion_category", [
  "course", "lesson", "assignment", "project", "ai", "general", "qna",
]);

export const discussionsTable = pgTable("discussion_threads", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  category: discussionCategoryEnum("category").notNull().default("general"),
  // Optional context links — exactly one may be set depending on category.
  courseId: integer("course_id"),
  lessonId: integer("lesson_id"),
  assignmentId: integer("assignment_id"),
  challengeId: integer("challenge_id"),
  teamId: integer("team_id"),
  title: text("title").notNull(),
  body: text("body").notNull(), // markdown, may include fenced code blocks
  isQuestion: boolean("is_question").notNull().default(false), // Q&A forum flag
  isResolved: boolean("is_resolved").notNull().default(false), // Q&A: accepted-answer flag
  acceptedPostId: integer("accepted_post_id"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiscussionSchema = createInsertSchema(discussionsTable).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, isResolved: true, acceptedPostId: true });
export type InsertDiscussion = z.infer<typeof insertDiscussionSchema>;
export type Discussion = typeof discussionsTable.$inferSelect;

export const discussionPostsTable = pgTable("discussion_posts", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => discussionsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  parentPostId: integer("parent_post_id"), // self-reference for nested replies
  body: text("body").notNull(), // markdown
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiscussionPostSchema = createInsertSchema(discussionPostsTable).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true });
export type InsertDiscussionPost = z.infer<typeof insertDiscussionPostSchema>;
export type DiscussionPost = typeof discussionPostsTable.$inferSelect;

// Reactions can target either a thread or a post (exactly one set).
export const discussionReactionsTable = pgTable("discussion_reactions", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => discussionsTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").references(() => discussionPostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull().default("👍"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiscussionReactionSchema = createInsertSchema(discussionReactionsTable).omit({ id: true, createdAt: true });
export type InsertDiscussionReaction = z.infer<typeof insertDiscussionReactionSchema>;
export type DiscussionReaction = typeof discussionReactionsTable.$inferSelect;

// File/image attachments (stored via Replit App Storage — see lib/objectStorage.ts).
export const discussionAttachmentsTable = pgTable("discussion_attachments", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => discussionsTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").references(() => discussionPostsTable.id, { onDelete: "cascade" }),
  uploaderId: integer("uploader_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  objectPath: text("object_path").notNull(), // e.g. /objects/uploads/<uuid>
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiscussionAttachmentSchema = createInsertSchema(discussionAttachmentsTable).omit({ id: true, createdAt: true });
export type InsertDiscussionAttachment = z.infer<typeof insertDiscussionAttachmentSchema>;
export type DiscussionAttachment = typeof discussionAttachmentsTable.$inferSelect;
