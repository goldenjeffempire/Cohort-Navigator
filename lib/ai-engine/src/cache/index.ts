/**
 * AI Response Cache
 *
 * In-memory LRU cache for AI inference results. Reduces latency for
 * repeated or near-identical queries against the built-in RAG engine.
 *
 * Only deterministic responses (built-in engine) are cached.
 * Streaming Ollama responses are NOT cached — they are already fast
 * and their content is highly context-dependent.
 *
 * Cache key = SHA-256 of (mode + trimmed user message).
 * Knowledge search results are cached separately with a shorter TTL
 * to reflect knowledge base updates promptly.
 */

import crypto from "crypto";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;     // Unix ms
  hits: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

// ─── LRU Cache implementation ──────────────────────────────────────────────────

class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(
    private readonly maxSize: number,
    private readonly defaultTtlMs: number,
  ) {}

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.stats.misses++;
      return null;
    }
    // LRU: move to end (most recently used)
    this.map.delete(key);
    entry.hits++;
    this.map.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key); // remove to re-insert at end
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest entry (first in Map iteration order)
      const firstKey = this.map.keys().next().value;
      if (firstKey) {
        this.map.delete(firstKey);
        this.stats.evictions++;
      }
    }
    this.map.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      hits: 0,
    });
  }

  invalidate(prefix: string): number {
    let count = 0;
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.map.clear();
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.map.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 1000) / 10 : 0,
    };
  }
}

// ─── Cache instances ───────────────────────────────────────────────────────────

// Response cache: larger TTL — RAG responses are deterministic for same inputs
const RESPONSE_TTL_MS        = 10 * 60 * 1000;  // 10 min
const RESPONSE_CACHE_MAX     = 500;

// Knowledge search cache: shorter TTL — refreshed when KB is updated
const KNOWLEDGE_TTL_MS       = 5 * 60 * 1000;   // 5 min
const KNOWLEDGE_CACHE_MAX    = 200;

export const responseCache  = new LRUCache<string>(RESPONSE_CACHE_MAX, RESPONSE_TTL_MS);
export const knowledgeCache = new LRUCache<unknown>(KNOWLEDGE_CACHE_MAX, KNOWLEDGE_TTL_MS);

// ─── Key generation ────────────────────────────────────────────────────────────

export function makeResponseCacheKey(mode: string, userMessage: string): string {
  const raw = `${mode}::${userMessage.trim().toLowerCase()}`;
  return `resp:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

export function makeKnowledgeCacheKey(query: string, limit: number): string {
  const raw = `${limit}::${query.trim().toLowerCase()}`;
  return `know:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

// ─── Invalidation helpers ──────────────────────────────────────────────────────

/**
 * Call after indexing new documents to flush stale knowledge search results.
 */
export function invalidateKnowledgeCache(): number {
  return knowledgeCache.invalidate("know:");
}

/**
 * Call after a prompt template update — cached responses built from the
 * old template are no longer valid for that mode.
 */
export function invalidateResponseCacheForMode(mode: string): number {
  // We can't selectively invalidate by mode since the key is a hash,
  // so we clear the whole response cache conservatively.
  // At 500 entries max, this is cheap.
  const size = responseCache.getStats().size;
  responseCache.clear();
  return size;
}

// ─── Cache statistics ──────────────────────────────────────────────────────────

export function getCacheStats(): { response: CacheStats; knowledge: CacheStats } {
  return {
    response:  responseCache.getStats(),
    knowledge: knowledgeCache.getStats(),
  };
}
