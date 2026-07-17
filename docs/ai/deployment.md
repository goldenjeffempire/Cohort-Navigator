# Deployment Guide

## Modes of Operation

JOE Hub's AI platform supports two operating modes. Both work in development and production.

### Mode 1: Built-in RAG Engine (Default)

No additional infrastructure required. Works out of the box.

**Capabilities:**
- Context-aware responses grounded in course content
- BM25 + cosine hybrid retrieval
- Full code analysis and assignment scoring
- Interview, career, quiz, and content generation
- Adaptive learning analytics

**Limitations:**
- Response quality depends on knowledge base completeness
- No free-form language generation beyond structured templates
- Best for technical questions with content coverage in the KB

**Production readiness:** ✅ Immediately ready. No configuration required.

---

### Mode 2: Local LLM via Ollama

Connect a running Ollama instance for full language model capabilities.

**Infrastructure:**

```
                    ┌──────────────────────────────┐
                    │        Ollama Server          │
                    │                              │
                    │  ollama run llama3.2         │
                    │  Listening: :11434           │
                    └──────────────┬───────────────┘
                                   │  HTTP /api/chat
                    ┌──────────────▼───────────────┐
                    │       JOE Hub API Server      │
                    │   AI_MODEL_ENDPOINT=          │
                    │   http://ollama-host:11434    │
                    └──────────────────────────────┘
```

**Setup:**

```bash
# 1. Install Ollama (Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull a model
ollama pull llama3.2           # 3B — fast, low RAM (4GB+)
ollama pull llama3.2:8b        # 8B — better quality (8GB+)
ollama pull codellama          # Optimised for code tasks

# 3. Start Ollama (background)
ollama serve &

# 4. Set environment variable
export AI_MODEL_ENDPOINT=http://localhost:11434

# 5. Register model in JOE Hub admin
curl -X POST /api/ai/admin/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "llama3.2-3b",
    "displayName": "Llama 3.2 3B",
    "modelId": "llama3.2",
    "provider": "local",
    "endpoint": "http://localhost:11434",
    "capabilities": "chat,code",
    "contextWindow": 131072,
    "maxTokens": 4096
  }'

# 6. Run evaluation
curl -X POST /api/ai/admin/models/1/evaluate

# 7. Activate if evaluation passes
curl -X POST /api/ai/admin/models/1/activate
```

---

## Recommended Model Selection

| Use Case | Model | RAM Required | Notes |
|----------|-------|-------------|-------|
| Development / Testing | `llama3.2:3b` | 4GB | Fast responses, good quality |
| Production (budget) | `llama3.2:8b` | 8GB | Best quality/cost ratio |
| Production (quality) | `llama3.1:70b` | 40GB | Near-GPT-4 quality |
| Code-focused | `codellama:13b` | 8GB | Excellent at code tasks |
| Multilingual | `llama3.1:8b` | 8GB | Strong multilingual support |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_MODEL_ENDPOINT` | No | — | Ollama server URL. If unset, uses built-in RAG. |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (auto-provisioned on Replit) |
| `SESSION_SECRET` | Yes | — | Session signing key |

> **Note:** No AI API keys are required. JOE Hub's AI platform is fully self-hosted.

---

## Initial Data Setup

After deploying, seed the knowledge base:

```bash
# 1. Seed course/lesson data
pnpm --filter @workspace/db run seed

# 2. Sync content to AI knowledge base
# (authenticated as admin)
curl -X POST /api/ai/knowledge/sync \
  -H "Cookie: <admin-session-cookie>"
# Response: {"indexed": 142, "message": "Sync complete."}
```

---

## Production Architecture

```
                              ┌─────────────────────┐
                              │   Load Balancer      │
                              │   (Replit Autoscale) │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                   │                     │
          ┌─────────▼──────┐  ┌─────────▼──────┐  ┌─────────▼──────┐
          │  API Instance 1 │  │  API Instance 2 │  │  API Instance N │
          │                │  │                │  │                │
          │  ai-engine     │  │  ai-engine     │  │  ai-engine     │
          │  (built-in)    │  │  (built-in)    │  │  (built-in)    │
          └─────────┬──────┘  └─────────┬──────┘  └─────────┬──────┘
                    │                   │                     │
                    └─────────┬─────────┘─────────┬──────────┘
                              │                   │
                    ┌─────────▼──────┐  ┌─────────▼──────┐
                    │   PostgreSQL   │  │   Ollama Server │
                    │  (managed)     │  │  (dedicated VM) │
                    └────────────────┘  └────────────────┘
```

**Key design points:**
- API instances are stateless — any instance can serve any request
- The in-process cache (`lib/ai-engine/src/cache/index.ts`) is per-instance; across instances, PostgreSQL is the shared knowledge store
- Ollama is deployed on a dedicated VM with GPU if available; API instances connect to it over the internal network
- The built-in RAG engine runs in-process in each API instance — no additional service needed

---

## Scaling Considerations

### Knowledge Base Scale

| Chunks | Retrieval Strategy |
|--------|--------------------|
| < 10k  | Full table scan (current) — very fast |
| 10k-100k | Add PostgreSQL `gin` index on `tsvector` for lexical; maintain pgvector extension for vector search |
| 100k+  | External vector DB (Qdrant, Weaviate, Chroma) as drop-in for the search function |

### Inference Scale

| Load | Strategy |
|------|----------|
| < 100 concurrent users | Single Ollama instance; built-in engine for bursts |
| 100-500 users | Multiple Ollama instances + round-robin load balancing |
| 500+ users | Dedicated inference cluster; vLLM for batch/streaming efficiency |

### Caching

The in-process LRU cache (500 response slots, 10-min TTL) reduces duplicate inference calls. For multi-instance deployments, add Redis for a shared cache layer:
1. Replace `responseCache` with a Redis client
2. Use the same `makeResponseCacheKey()` function for the Redis key
3. Set Redis TTL to 600 seconds

---

## Health Checks

```
GET /api/health
→ { status: "ok", db: "connected" }

GET /api/ai/admin/status
→ {
    mode: "local_model" | "built_in_rag",
    localOnline: true | false,
    localModelEndpoint: "http://...",
    registry: { models: 2 },
    usage: { conversations: 1247, messages: 8932 }
  }
```

Monitor `localOnline` — if it flips to `false`, the API falls back to the built-in engine automatically, but you should investigate and restart Ollama.
