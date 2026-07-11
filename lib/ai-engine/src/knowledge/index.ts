/**
 * Knowledge Base Management
 *
 * Handles indexing of course content, lessons, challenges, and documentation
 * into the ai_knowledge_chunks table for retrieval-augmented generation.
 */

import { db, aiKnowledgeChunksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export type KnowledgeSourceType = "lesson" | "course" | "documentation" | "challenge" | "faq" | "manual";

export interface KnowledgeDocument {
  sourceType: KnowledgeSourceType;
  sourceId: number;
  title: string;
  content: string;
  tags?: string;
  language?: string;
}

// ─── Chunking ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 800;     // characters per chunk
const CHUNK_OVERLAP = 100;  // character overlap between chunks

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─── TF-IDF vector ───────────────────────────────────────────────────────────

function buildTfIdf(text: string): Record<string, number> {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  const maxF = Math.max(...Object.values(tf), 1);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(tf)) {
    result[k] = v / maxF; // normalised TF
  }
  return result;
}

// ─── Indexing ────────────────────────────────────────────────────────────────

export async function indexDocument(doc: KnowledgeDocument): Promise<number> {
  const chunks = chunkText(doc.content);
  let indexed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const hash = crypto.createHash("sha256").update(chunk).digest("hex").slice(0, 16);

    // Skip if unchanged
    const existing = await db
      .select({ id: aiKnowledgeChunksTable.id, contentHash: aiKnowledgeChunksTable.contentHash })
      .from(aiKnowledgeChunksTable)
      .where(
        and(
          eq(aiKnowledgeChunksTable.sourceType, doc.sourceType as any),
          eq(aiKnowledgeChunksTable.sourceId, doc.sourceId),
          eq(aiKnowledgeChunksTable.chunkIndex, i),
        ),
      )
      .limit(1);

    if (existing[0]?.contentHash === hash) continue;

    const values = {
      sourceType: doc.sourceType as any,
      sourceId: doc.sourceId,
      title: `${doc.title}${chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ""}`,
      content: chunk,
      tfidfVector: buildTfIdf(chunk),
      tags: doc.tags,
      language: doc.language,
      chunkIndex: i,
      totalChunks: chunks.length,
      contentHash: hash,
      indexed: true,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      await db.update(aiKnowledgeChunksTable).set(values).where(eq(aiKnowledgeChunksTable.id, existing[0].id));
    } else {
      await db.insert(aiKnowledgeChunksTable).values(values);
    }
    indexed++;
  }

  // Remove stale chunks if document shrank
  if (chunks.length === 0) {
    await db.delete(aiKnowledgeChunksTable).where(
      and(
        eq(aiKnowledgeChunksTable.sourceType, doc.sourceType as any),
        eq(aiKnowledgeChunksTable.sourceId, doc.sourceId),
      ),
    );
  }

  return indexed;
}

export async function deleteDocumentChunks(sourceType: KnowledgeSourceType, sourceId: number): Promise<void> {
  await db.delete(aiKnowledgeChunksTable).where(
    and(
      eq(aiKnowledgeChunksTable.sourceType, sourceType as any),
      eq(aiKnowledgeChunksTable.sourceId, sourceId),
    ),
  );
}

export async function getKnowledgeStats(): Promise<{
  totalChunks: number;
  bySource: Record<string, number>;
}> {
  const all = await db.select({ sourceType: aiKnowledgeChunksTable.sourceType }).from(aiKnowledgeChunksTable);
  const bySource: Record<string, number> = {};
  for (const r of all) bySource[r.sourceType] = (bySource[r.sourceType] ?? 0) + 1;
  return { totalChunks: all.length, bySource };
}

export { searchKnowledge } from "./retrieval.js";
