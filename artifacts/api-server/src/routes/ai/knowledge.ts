/**
 * AI Knowledge Base routes
 *
 * GET  /ai/knowledge/search         — semantic search
 * POST /ai/knowledge/index          — index a document (admin/mentor)
 * GET  /ai/knowledge/stats          — index stats (admin)
 * DELETE /ai/knowledge/:sourceType/:sourceId — remove from index (admin)
 * POST /ai/knowledge/sync           — sync all course content (admin)
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  aiKnowledgeChunksTable,
  lessonsTable,
  codingChallengesTable,
} from "@workspace/db";
import {
  indexDocument,
  deleteDocumentChunks,
  getKnowledgeStats,
  searchKnowledge,
} from "@workspace/ai-engine/knowledge";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

// ─── Semantic search ──────────────────────────────────────────────────────────

router.get("/ai/knowledge/search", requireAuth, async (req, res): Promise<void> => {
  const { q, limit = "5" } = req.query as Record<string, string>;
  if (!q?.trim()) { res.status(400).json({ error: "q required" }); return; }

  const results = await searchKnowledge(q, Math.min(parseInt(limit) || 5, 20));
  res.json(results);
});

// ─── Index a document ────────────────────────────────────────────────────────

router.post("/ai/knowledge/index", requireAuth, requireRole("admin", "mentor"), async (req, res): Promise<void> => {
  const { sourceType, sourceId, title, content, tags, language } = req.body;
  if (!sourceType || !sourceId || !content) {
    res.status(400).json({ error: "sourceType, sourceId, content required" });
    return;
  }

  const count = await indexDocument({ sourceType, sourceId, title: title ?? `${sourceType} #${sourceId}`, content, tags, language });
  res.json({ indexed: count, message: `Indexed ${count} chunk(s)` });
});

// ─── Get index stats ──────────────────────────────────────────────────────────

router.get("/ai/knowledge/stats", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const stats = await getKnowledgeStats();
  res.json(stats);
});

// ─── Delete from index ────────────────────────────────────────────────────────

router.delete("/ai/knowledge/:sourceType/:sourceId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { sourceType, sourceId } = req.params;
  await deleteDocumentChunks(sourceType as any, parseInt(sourceId));
  res.json({ message: "Removed from index" });
});

// ─── Sync all lessons / challenges ───────────────────────────────────────────

router.post("/ai/knowledge/sync", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  let total = 0;
  const errors: string[] = [];

  // Index lessons
  const lessons = await db.select({
    id: lessonsTable.id,
    title: lessonsTable.title,
    content: lessonsTable.content,
  }).from(lessonsTable);

  for (const lesson of lessons) {
    if (!lesson.content) continue;
    try {
      const n = await indexDocument({ sourceType: "lesson", sourceId: lesson.id, title: lesson.title, content: lesson.content, tags: "lesson" });
      total += n;
    } catch (e: any) {
      errors.push(`lesson ${lesson.id}: ${e.message}`);
    }
  }

  // Index challenges
  const challenges = await db.select({
    id: codingChallengesTable.id,
    title: codingChallengesTable.title,
    description: codingChallengesTable.description,
    language: codingChallengesTable.language,
    tags: codingChallengesTable.tags,
  }).from(codingChallengesTable);

  for (const ch of challenges) {
    try {
      const n = await indexDocument({
        sourceType: "challenge",
        sourceId: ch.id,
        title: ch.title,
        content: `${ch.title}\n\n${ch.description}`,
        language: ch.language,
        tags: ch.tags ?? "challenge",
      });
      total += n;
    } catch (e: any) {
      errors.push(`challenge ${ch.id}: ${e.message}`);
    }
  }

  res.json({ indexed: total, errors, message: `Sync complete. ${total} chunks indexed.` });
});

export default router;
