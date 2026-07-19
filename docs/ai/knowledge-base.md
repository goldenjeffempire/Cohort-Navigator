# Knowledge Base & RAG Pipeline

## Overview

JOE Forge's knowledge base stores course content, lessons, challenges, and documentation as searchable vector chunks. The Retrieval-Augmented Generation (RAG) pipeline grounds AI responses in real platform content, reducing hallucination and keeping answers relevant to what students are actually learning.

**Everything runs on-device.** No external embedding APIs, no vector database service, no network calls. Embeddings are computed with a hash-trick algorithm and stored as JSON arrays in PostgreSQL.

---

## Document Ingestion Pipeline

```
Source document (lesson, challenge, doc)
  │
  ▼
chunkText()           → 800-char chunks, 100-char overlap
  │
  ├─ SHA-256 hash     → content_hash (deduplication)
  │
  ├─ buildTfIdf()     → { term: normalised_tf } (JSON)
  │
  └─ embed()          → number[256] unit vector (JSON)
  │
  ▼
INSERT / UPDATE ai_knowledge_chunks
  (sourceType, sourceId, title, content, tfidfVector, embedding, contentHash)
```

### Chunking Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk size | 800 chars | Fits in prompt context without truncation; large enough for meaningful content |
| Overlap | 100 chars | Prevents information loss at chunk boundaries |
| Min content | 10 chars | Skip empty or near-empty sections |

### Deduplication

Each chunk is SHA-256 hashed. On re-indexing (e.g. after a lesson edit), the hash is compared to the stored value. If unchanged, the chunk is skipped. This makes `POST /ai/knowledge/sync` idempotent and cheap.

---

## Embeddings: Hash Trick (FNV-1a)

**File:** `lib/ai-engine/src/knowledge/embeddings.ts`

JOE Forge uses a *signed feature-hashing* approach (also called the "hashing trick") instead of a neural sentence transformer. This eliminates the need to download/host model weights and runs in microseconds.

### Algorithm

```
1. Tokenise: lowercase → remove punctuation → split on whitespace → filter len < 2
2. Augment: add character 3-grams per word (e.g. "debug" → ["#deb","#ebu","#bug"])
   └─ Adds sub-word robustness: "debugging" ≈ "debug" share n-gram overlap
3. For each token t:
   bucket = FNV1a(t, seed=0) % 256
   sign   = FNV1a(t, seed=1) % 2 == 0 ? +1 : -1
   vec[bucket] += sign
4. L2-normalise the 256-dim vector → unit vector (cosine similarity ∈ [-1, 1])
```

### Properties

- **Dimension:** 256 — compact enough for fast cosine comparison even with 10k+ chunks
- **Deterministic:** same text always produces same vector (no randomness)
- **Collision-resistant:** signed hashing reduces bias from collisions
- **Drop-in replaceable:** the `embed()` function signature is stable; swapping in an ONNX sentence-transformer later only requires replacing this one function

### Limitations vs Neural Embeddings

| Property | Hash Trick | Sentence Transformer |
|----------|-----------|---------------------|
| Semantic similarity | Partial (n-gram overlap) | Strong (meaning-level) |
| Exact term matching | Excellent | Good |
| Typo robustness | Good (n-grams) | Excellent |
| Infrastructure | None | GPU or ONNX runtime |
| Latency | < 1ms | 10-100ms per chunk |

For a course-content-scale knowledge base (< 50k chunks), the hybrid BM25 + hash-trick approach is highly effective because most student queries use terms that appear directly in the course material.

---

## Hybrid Retrieval

**File:** `lib/ai-engine/src/knowledge/retrieval.ts`

Search combines two complementary signals:

### BM25 (Lexical)

Classic probabilistic term-matching score. Rewards exact and partial term matches, penalises very long documents.

```
BM25(doc, query) = Σ IDF(t) × (f(t,d) × (k1+1)) / (f(t,d) + k1×(1 - b + b×|d|/avgLen))
k1 = 1.5, b = 0.75, avgLen ≈ 200 tokens
```

**Strengths:** Precise for exact/partial keyword queries ("what is useState", "Python list comprehension")

### Cosine Similarity (Semantic)

Inner product of the query embedding and each chunk's stored embedding. Both are unit-normalised so the result is cosine similarity ∈ [-1, 1].

**Strengths:** Catches paraphrase matches ("infinite loop" vs "loop that never terminates")

### Blended Score

```
score = 0.65 × normalised_BM25 + 0.35 × cosine
```

BM25 is normalised to [0, 1] via `score / (score + 5)` before blending to make it comparable to cosine.

The 65/35 split favours exact term precision for a technical learning domain. Adjust these weights if the KB grows to include more diverse non-technical prose.

### Retrieval Steps

1. **Lexical recall** — PostgreSQL `ILIKE` filter on the top 5 query terms → up to 50 candidates
2. **Semantic recall** — full table scan with cosine similarity, top 20 results → added to candidate set
3. **Merge** — deduplicate by ID; union of both recall stages
4. **Re-rank** — compute BM25 + cosine blended score for all candidates
5. **Return top N** — default 5, configurable up to 20

---

## Knowledge Sources

| Source type | Description | Synced by |
|-------------|-------------|-----------|
| `lesson` | Lesson body content | `POST /ai/knowledge/sync` |
| `challenge` | Challenge title + description | `POST /ai/knowledge/sync` |
| `course` | Course overview and objectives | Manual or sync |
| `documentation` | Platform docs, FAQs | Manual indexing |
| `faq` | Frequently asked questions | Manual indexing |
| `manual` | Admin-uploaded content | `POST /ai/knowledge/index` |

---

## Administration

### Sync Course Content

```
POST /api/ai/knowledge/sync
Authorization: admin

Response:
{
  "indexed": 142,
  "errors": [],
  "message": "Sync complete. 142 chunks indexed."
}
```

Sync is idempotent — runs can be repeated safely. Unchanged content is skipped.

### Manual Indexing

```
POST /api/ai/knowledge/index
Authorization: admin | mentor

Body:
{
  "sourceType": "documentation",
  "sourceId": 1,
  "title": "Introduction to Async/Await",
  "content": "...",
  "tags": "javascript,async",
  "language": "javascript"
}
```

### Semantic Search (Testing)

```
GET /api/ai/knowledge/search?q=how+does+async+await+work&limit=5
Authorization: any authenticated user
```

### Stats

```
GET /api/ai/knowledge/stats
Authorization: admin

Response:
{
  "totalChunks": 312,
  "bySource": {
    "lesson": 240,
    "challenge": 60,
    "manual": 12
  }
}
```

### Remove from Index

```
DELETE /api/ai/knowledge/:sourceType/:sourceId
Authorization: admin
```

---

## Recommended Sync Schedule

| Trigger | Action |
|---------|--------|
| New lesson published | Index the lesson automatically (webhook from lesson creation) |
| Lesson edited | Re-index (hash dedup makes this cheap) |
| New challenge added | Re-sync challenges |
| Weekly maintenance | Full sync to catch any missed updates |
| Model endpoint changed | Re-sync + re-evaluate (embeddings are stable, but re-sync builds familiarity) |
