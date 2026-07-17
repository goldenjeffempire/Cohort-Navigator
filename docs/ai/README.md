# JOE Hub — Native AI Platform Documentation

JOE Hub runs a fully **self-hosted AI ecosystem** with zero dependency on external AI services (OpenAI, Anthropic, Google, etc.). Every inference, retrieval, embedding, analysis, and analytics computation runs on JOE Hub's own infrastructure.

## Documents in this Directory

| Document | Description |
|---|---|
| [architecture.md](./architecture.md) | Full AI system architecture, service layers, and data flows |
| [knowledge-base.md](./knowledge-base.md) | RAG pipeline, embeddings, indexing, and retrieval |
| [mlops.md](./mlops.md) | Model versioning, evaluation, deployment, and monitoring |
| [security.md](./security.md) | Prompt injection protection, access control, audit logging |
| [deployment.md](./deployment.md) | Production deployment, Ollama integration, scaling |
| [api.md](./api.md) | Complete AI API reference |

## Quick Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        JOE Hub AI Platform                      │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ AI Tutor │ │ AI Code  │ │Interview │ │ Career   │          │
│  │  /tutor  │ │Assistant │ │  Coach   │ │ Advisor  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  API Server (Express 5)  /api/ai/*                              │
│  ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐  │
│  │  chat   │ │  code  │ │ tools  │ │knowledge │ │  admin   │  │
│  │ SSE     │ │analyze │ │ tools  │ │  search  │ │ models   │  │
│  │ stream  │ │explain │ │ career │ │   sync   │ │  eval    │  │
│  └─────────┘ └────────┘ └────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  @workspace/ai-engine (lib/ai-engine)                           │
│  ┌────────────┐  ┌───────────────────────────────────────────┐  │
│  │ Inference  │  │          Knowledge Base (RAG)             │  │
│  │  Engine    │  │  embed() → BM25+cosine hybrid retrieval   │  │
│  │            │  │  (FNV-1a hash trick, 256-dim vectors)     │  │
│  │  Ollama ←─ │  └───────────────────────────────────────────┘  │
│  │  RAG    ←─ │  ┌──────────────┐  ┌───────────────────────┐   │
│  └────────────┘  │   Analysis   │  │  Adaptive Learning    │   │
│                  │ code quality │  │  skill gap, risk,     │   │
│                  │  assignment  │  │  velocity, forecast   │   │
│                  └──────────────┘  └───────────────────────┘   │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  Prompts   │  │   Security   │  │    Analytics          │   │
│  │ templates  │  │ injection,   │  │ cohort, course,       │   │
│  │  safety    │  │ abuse detect │  │ mentor, platform      │   │
│  └────────────┘  └──────────────┘  └───────────────────────┘   │
│  ┌────────────┐  ┌──────────────┐                               │
│  │Evaluation  │  │    Cache     │                               │
│  │ MLOps eval │  │ LRU + TTL    │                               │
│  │   suite    │  │  response    │                               │
│  └────────────┘  └──────────────┘                               │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  (@workspace/db)                                    │
│  ai_conversations · ai_messages · ai_knowledge_chunks           │
│  ai_models · ai_model_evaluations · ai_prompt_templates         │
│  ai_audit_logs · ai_feedback · ai_usage_metrics                 │
│  ai_learning_profiles · ai_skill_assessments                    │
│  ai_interview_sessions · ai_content_generations                 │
└─────────────────────────────────────────────────────────────────┘
```

## Running Modes

### Mode 1: Built-in RAG Engine (Default — No Configuration Required)
JOE Hub ships with a fully functional RAG-based response engine. No model downloads, no GPU, no API keys.

- Retrieval: BM25 + cosine similarity over self-hosted hash-trick embeddings
- Response: Structured template responses grounded in course knowledge base
- Code analysis: Rule-based quality metrics (nesting, complexity, magic numbers)
- Always available; zero operational cost

### Mode 2: Local LLM via Ollama (Recommended for Production)
Point `AI_MODEL_ENDPOINT` at a running Ollama instance for full language model capabilities.

```bash
# Install Ollama, pull a model, set the env var
ollama pull llama3.2
export AI_MODEL_ENDPOINT=http://localhost:11434
```

The inference engine automatically detects and routes to Ollama when the endpoint is reachable, falling back to the built-in engine if the request fails.

## Development

```bash
# Sync course content to knowledge base
pnpm --filter @workspace/api-server run dev
# POST /api/ai/knowledge/sync  (admin only)

# Run evaluation suite
# POST /api/ai/admin/models/:id/evaluate  (admin only)

# Check engine status
# GET /api/ai/admin/status  (admin only)
```
