/**
 * Self-Hosted Local Embeddings (Feature Hashing / "Hashing Trick")
 *
 * Produces a fixed-dimension dense vector for a piece of text entirely
 * on-device — no external API calls, no model weights to download, no
 * network access required. This is the same family of technique used by
 * production systems (Vowpal Wabbit, fastText's hashed n-gram mode) when a
 * full neural embedding model is unnecessary or infeasible to host.
 *
 * How it works:
 *  1. Tokenise into words and character n-grams (captures sub-word /
 *     misspelling similarity that pure word-level TF-IDF misses).
 *  2. Hash each token into one of EMBED_DIM buckets with a sign determined
 *     by a second hash (reduces collision bias — the "signed hashing trick").
 *  3. L2-normalise the resulting vector so cosine similarity is well-behaved.
 *
 * This embedding is combined with BM25 lexical scoring in retrieval.ts for
 * hybrid search — lexical for exact-term precision, vector for fuzzy /
 * paraphrase recall. Swapping in a real neural encoder later (e.g. a
 * self-hosted ONNX sentence-transformer served by the same process) is a
 * drop-in replacement for `embed()` — nothing else in the pipeline changes.
 */

export const EMBED_DIM = 256;

function hashString(str: string, seed: number): number {
  // FNV-1a 32-bit — fast, deterministic, good distribution for short strings.
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tokenizeForEmbedding(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const tokens: string[] = [...words];

  // Character 3-grams per word add robustness to typos / morphological
  // variants (e.g. "debugging" vs "debug") without needing a stemmer.
  for (const w of words) {
    if (w.length < 3) continue;
    for (let i = 0; i <= w.length - 3; i++) {
      tokens.push("#" + w.slice(i, i + 3));
    }
  }
  return tokens;
}

/** Compute a dense EMBED_DIM-length unit vector for `text`. */
export function embed(text: string): number[] {
  const vec = new Array(EMBED_DIM).fill(0);
  const tokens = tokenizeForEmbedding(text);
  for (const tok of tokens) {
    const bucket = hashString(tok, 0) % EMBED_DIM;
    const sign = hashString(tok, 1) % 2 === 0 ? 1 : -1;
    vec[bucket] += sign;
  }
  // L2 normalise
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot; // both vectors are already unit-normalised
}
