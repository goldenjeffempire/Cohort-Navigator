# MLOps — Model Lifecycle & Continuous Evaluation

## Overview

JOE Hub's MLOps system manages the lifecycle of AI models with:
- A **model registry** tracking all known model configurations and versions
- A **continuous evaluation harness** that gates model promotion with deterministic quality checks
- **Usage metrics** aggregated daily for trend analysis
- **Feedback loops** from student ratings into quality monitoring

All tooling is built-in — no external MLflow, Weights & Biases, or similar services required.

---

## Model Registry (`ai_models`)

Each row represents a model configuration:

| Column | Description |
|--------|-------------|
| `name` | Unique slug (`llama3.2-3b`, `built-in-rag-v1`) |
| `displayName` | Human-readable name |
| `provider` | `local` (Ollama) or `openai-compatible` |
| `modelId` | Ollama model tag (`llama3.2:3b`) |
| `endpoint` | Override URL; inherits `AI_MODEL_ENDPOINT` if null |
| `capabilities` | Comma-separated: `chat,code,analysis` |
| `contextWindow` | Token context window size |
| `maxTokens` | Max output tokens |
| `status` | `active` | `inactive` | `deprecated` | `testing` |
| `isDefault` | True for exactly one model at a time |
| `version` | Monotonically incremented when config changes |

### Registering a Model

```
POST /api/ai/admin/models
Authorization: admin

{
  "name": "llama3.2-3b",
  "displayName": "Llama 3.2 3B",
  "provider": "local",
  "modelId": "llama3.2:3b",
  "endpoint": "http://localhost:11434",
  "capabilities": "chat,code",
  "contextWindow": 131072,
  "maxTokens": 4096
}
```

### Activating a Model

```
POST /api/ai/admin/models/:id/activate
Authorization: admin
```

Sets `isDefault = true` on this model and `false` on all others.
The active model is picked up by `inferenceEngine` on the next request — no restart required.

---

## Evaluation Harness (`lib/ai-engine/src/evaluation/index.ts`)

The evaluation harness runs a fixed suite of representative prompts against the currently active engine and checks responses against deterministic pass/fail criteria.

### Default Evaluation Suite

| Case | Mode | Prompt | Checks |
|------|------|--------|--------|
| `tutor-explain-concept` | tutor | "Explain what a hash map is and why it's fast." | contains "hash", min 40 chars, ≤ 15s |
| `code-debug-help` | code | "My for loop never terminates…" | contains "loop", min 30 chars, ≤ 15s |
| `assignment-feedback` | assignment | "Give feedback on an assignment with no error handling or comments." | min 30 chars, ≤ 15s |
| `interview-question` | interview | "Ask me one behavioral interview question." | min 20 chars, ≤ 15s |
| `quiz-generation` | quiz | "Give me one practice question about arrays." | contains "array", min 20 chars, ≤ 15s |

### Running an Evaluation

```
POST /api/ai/admin/models/:id/evaluate
Authorization: admin

Response:
{
  "id": 42,
  "modelId": 3,
  "modelVersion": 1,
  "suiteName": "default",
  "casesRun": 5,
  "casesPassed": 5,
  "avgLatencyMs": 1842,
  "avgOutputTokens": 87.4,
  "score": 100,
  "details": [
    { "name": "tutor-explain-concept", "passed": true, "latencyMs": 1502, "outputTokens": 112 },
    ...
  ],
  "createdAt": "2026-07-17T..."
}
```

### Comparing Evaluations

```
GET /api/ai/admin/models/:id/evaluations
Authorization: admin
```

Returns the last 20 evaluation runs for this model, ordered newest-first. Compare `score`, `avgLatencyMs`, and per-case `passed` status across versions.

### Promotion Gate

Before activating a new model:
1. Register the model with `POST /api/ai/admin/models`
2. Optionally set it as `testing` status
3. Run the evaluation suite: `POST /api/ai/admin/models/:id/evaluate`
4. Review the results — all 5 cases should pass, latency within budget
5. If passing, activate: `POST /api/ai/admin/models/:id/activate`

---

## Dataset Management

JOE Hub's "training dataset" is the knowledge base itself — course content that has been indexed into `ai_knowledge_chunks`. No separate dataset management service is needed.

### Adding Training Data

```
# Index all lessons and challenges
POST /api/ai/knowledge/sync

# Add custom documentation
POST /api/ai/knowledge/index
{
  "sourceType": "documentation",
  "sourceId": 99,
  "title": "Advanced TypeScript Patterns",
  "content": "..."
}
```

### Eval-Driven Data Quality

Monitor `ai_feedback` (student message ratings 1-5) alongside evaluation scores:
- **Consistent low ratings** for a mode → the knowledge base for that topic is thin; add more content
- **Evaluation passes but low ratings** → response quality is fine structurally but not helpful; review prompt templates
- **Evaluation fails but ratings OK** → eval suite too strict; consider relaxing keyword requirements

---

## Usage Metrics (`ai_usage_metrics`)

Aggregated daily (YYYY-MM-DD) per AI mode:

| Column | Description |
|--------|-------------|
| `date` | Day in YYYY-MM-DD format |
| `mode` | AI conversation mode |
| `totalRequests` | Inference calls that day |
| `totalTokensIn` / `Out` | Approximate token counts |
| `avgLatencyMs` | Average end-to-end latency |
| `errorCount` | Failed inference calls |
| `flaggedCount` | Requests blocked by content filter |
| `uniqueUsers` | Distinct users who made AI requests |

Query via `GET /api/ai/admin/metrics` (returns last 30 days).

---

## Feedback Loop

Student message feedback (1-5 stars) is stored in `ai_feedback` and accessible at:
```
GET /api/ai/admin/feedback     → recent 100 feedback items
GET /api/ai/admin/analytics    → avg rating, flagged count, conversation breakdown
```

Use average rating trends to guide:
- **Knowledge base updates** (low tutor ratings → thin content)
- **Prompt template refinement** (low code ratings → hint instructions not clear)
- **Mode-specific eval case additions** (patterns of poor performance → add eval cases)

---

## Continuous Improvement Workflow

```
Weekly:
  1. Review GET /api/ai/admin/analytics  — any rating drops?
  2. Review GET /api/ai/admin/feedback   — read low-rating comments
  3. POST /api/ai/knowledge/sync         — refresh KB with new lessons
  4. POST /api/ai/admin/models/:id/evaluate — check eval still passes

On model change:
  1. Register new model config
  2. Run evaluation (all cases must pass)
  3. Activate if passing
  4. Monitor metrics for 24h (latency, error rate)
  5. Roll back by activating previous model if regression detected
```
