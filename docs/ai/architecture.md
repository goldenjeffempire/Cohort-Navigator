# AI Architecture

## Overview

JOE Forge's AI platform is a native, self-hosted system with no dependency on third-party AI APIs. It is composed of six layers:

1. **Inference Engine** — routes requests to a local model (Ollama) or the built-in RAG fallback
2. **Knowledge Base** — RAG pipeline backed by course content, indexed in PostgreSQL
3. **Analysis Engine** — deterministic code quality, assignment scoring, learning insights
4. **Adaptive Learning Engine** — skill gap analysis, risk detection, performance forecasting
5. **Security Layer** — prompt injection protection, abuse detection, audit logging
6. **Analytics Engine** — student, cohort, mentor, and platform analytics

---

## 1. Inference Engine (`lib/ai-engine/src/inference/index.ts`)

### Architecture

```
Request
  │
  ▼
inferenceEngine.stream(messages, opts)
  │
  ├─── AI_MODEL_ENDPOINT set & reachable? ──► streamOllama()
  │       │
  │       │   POST /api/chat (Ollama wire format)
  │       │   Streams NDJSON → yields StreamChunk tokens
  │       │
  │       └─── on error ──► falls through to built-in
  │
  └─── Built-in RAG engine ──► streamBuiltIn()
          │
          ├─── retrievalEngine.generateResponse()
          │      ├─── searchKnowledge(query, 4)   [hybrid BM25 + cosine]
          │      └─── generateStructuredResponse() [template per mode]
          │
          └─── Simulate streaming (word-by-word with 12ms pacing)
```

### Interface

```typescript
const engine = createInferenceEngine();

// Streaming (SSE)
for await (const chunk of engine.stream(messages, opts)) {
  if (!chunk.done) process.stdout.write(chunk.content);
  else console.log("Done:", chunk.result);
}

// Non-streaming (batch)
const result = await engine.complete(messages, opts);
```

### Fallback Strategy

The engine always delivers a response. If Ollama fails mid-stream, the error is logged and the built-in engine takes over for the next request. This ensures 100% uptime for AI features even during model server restarts.

---

## 2. Knowledge Base & RAG Pipeline

See [knowledge-base.md](./knowledge-base.md) for full detail.

**Summary:**
- Documents are chunked (800 chars, 100 char overlap) and stored with TF-IDF weights and a 256-dim local embedding
- Retrieval combines BM25 lexical scoring (65%) with cosine similarity (35%)
- Embeddings use FNV-1a hashing trick — no model weights, no GPU, no network

---

## 3. Prompt Management System (`lib/ai-engine/src/prompts/index.ts`)

### Built-in Templates

Eight built-in prompt templates cover all AI modes:

| Mode | Role | Key Behaviour |
|------|------|---------------|
| `tutor` | Learning assistant | Socratic method; no direct answers to graded work |
| `code` | Code assistant | Hints only for challenges; full help for general questions |
| `assignment` | Assignment coach | Guide without completing; rubric-aware feedback |
| `interview` | Interview simulator | Question-answer-feedback loop; structured scoring |
| `career` | Career advisor | Resume, GitHub, LinkedIn, roadmap guidance |
| `quiz` | Quiz generator | Mixed question types; explanations included |
| `review` | Code reviewer | 7-dimension structured review (correctness, quality, etc.) |
| `general` | General assistant | Platform navigation, general Q&A |

### Template Variables

Templates support `{{variable}}` substitution:

```typescript
renderPrompt("tutor", {
  userName: "Alice",
  userRole: "student",
  courseName: "Web Development Bootcamp",
  lessonTitle: "Async/Await Deep Dive",
});
```

### Safety Guards

Two-pass input filtering:
1. **Injection patterns** — 8 regex patterns covering common jailbreak attempts
2. **Harmful content** — 3 patterns for hacking, malware, credential theft

Blocked inputs are logged to `ai_audit_logs` and never reach the inference layer.

---

## 4. Code & Assignment Analysis (`lib/ai-engine/src/analysis/index.ts`)

### Code Quality Metrics

Rule-based, language-agnostic analysis:

| Metric | How computed |
|--------|-------------|
| Nesting depth | Opening/closing brace scan |
| Comment ratio | Lines starting with `//`, `#`, `*`, `/*` |
| Function count | Regex: `function`, `=>`, `def`, `fn` |
| Magic numbers | Regex: standalone multi-digit number literals |
| Duplicate lines | Set-based deduplication on trimmed lines ≥ 10 chars |
| Long lines | Count of lines > 120 characters |
| Eval usage | Direct `eval(` pattern (JS/TS security check) |

Output: `CodeQualityReport` with score (0-100), grade (A-F), issues, and suggestions.

### Assignment Scoring

Decomposes a rubric into weighted components:
- **Correctness** (40%): requires test execution (provided by code executor)
- **Code quality** (25%): from `analyzeCode()` score
- **Readability** (20%): based on comment ratio thresholds
- **Documentation** (15%): based on comment density

---

## 5. Adaptive Learning Engine (`lib/ai-engine/src/learning/adaptive.ts`)

### Competency Model

Each student has a `skillScores` map: `topic → score (0-100)`.

Scores are updated via Exponentially-Weighted Moving Average (EWM):
```
newScore = α × eventScore + (1 - α) × currentScore     (α = 0.3)
```

This gives recent assessments more weight while preserving historical context.

### Skill Taxonomy

A two-level taxonomy maps specific topic tags to broader skill areas:
```
"Data Structures" → ["arrays", "objects", "linked-list", "stack", "queue", ...]
"JavaScript"      → ["javascript", "js", "es6", "promises", "async", ...]
```

### Risk Detection

Five-factor risk scoring:
1. Pass rate < 30% → +3 points
2. Learning velocity < 0.5 items/week → +2 points
3. Days since last activity > 14 → +3 points
4. Competency score < 30 → +2 points
5. Low AI engagement despite struggles → +1 point

Score ≥ 7 → `high` risk; ≥ 4 → `medium`; ≥ 2 → `low`; else `none`

### Performance Forecasting

Linear regression over historical competency scores:
```
slope = Σ((x - x̄)(y - ȳ)) / Σ((x - x̄)²)
projectedScore = currentScore + slope × (weeksRemaining × 7)
```

Confidence: high (≥5 data points), medium (3-4), low (<3).

---

## 6. Security Layer (`lib/ai-engine/src/security/index.ts`)

See [security.md](./security.md) for full detail.

**Summary:**
- Content safety scoring: 15 pattern categories, block threshold at score ≥ 60
- Abuse detection: per-user sliding-window rate tracking (30 req/min)
- PII scrubbing: email, phone, card, SSN, password, token patterns → redacted before logging
- Anomaly detection: off-hours bursts, rapid mode switching, payload stuffing

---

## 7. AI Microservice Boundaries

All AI routes are served by the single Express API server. There is no separate AI microservice. The separation is at the package boundary:

```
artifacts/api-server/  ← HTTP transport, auth, rate limiting, DB writes
lib/ai-engine/         ← Pure AI logic; no HTTP, no auth
lib/db/                ← Shared schema; ai_* tables
```

This keeps the AI logic testable in isolation while sharing the database layer with the rest of the platform.

---

## 8. Model Registry

The `ai_models` table is a registry of all known model configurations. Admins can:
- Register new Ollama model configurations (name, endpoint, capabilities)
- Activate a model as default (one active at a time)
- Run the evaluation suite against any registered model
- Compare evaluation results across versions before promoting

---

## 9. Data Flow — End-to-End Chat Request

```
1. Student sends message → POST /api/ai/conversations/:id/messages
2. Auth middleware validates session (Clerk JWT / cookie)
3. Rate limit middleware checks ai_rate_limit bucket
4. Safety check: sanitizeInput() + scoreContentSafety()
   └─ if blocked → insert ai_audit_logs (event: content_flagged) → 400
5. Load conversation history (last 10 turns from ai_messages)
6. renderPrompt(mode, context) → system prompt with {{vars}} filled
7. inferenceEngine.stream(messages) →
   ├─ Ollama: POST /api/chat → NDJSON stream
   └─ Built-in: searchKnowledge() + generateStructuredResponse()
8. SSE stream chunks to client
9. On completion:
   ├─ INSERT ai_messages (role: assistant, tokens, latency)
   ├─ UPDATE ai_conversations (updatedAt)
   └─ INSERT ai_audit_logs (event: inference_response)
```
