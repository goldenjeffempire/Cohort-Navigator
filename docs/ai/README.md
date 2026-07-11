# JOE Hub — Native AI Platform

This document describes the fully self-hosted AI system that powers JOE Hub's
learning assistant, coding assistant, assignment evaluation, interview coach,
personalization, analytics, and content generation features. **No part of
this system calls a third-party AI API** (no OpenAI, Anthropic, Gemini,
Cohere, etc.). Every inference, retrieval, and analysis step runs inside this
project's own containers/processes, against this project's own database.

## 1. Architecture

```
                       ┌────────────────────────────┐
 joe-hub (React SPA)   │        api-server           │        lib/ai-engine
 ─────────────────     │  (Express, /api/ai/*)       │   ─────────────────────
 AIHub / AITutor /  ───▶  chat.ts   code.ts  tools.ts │──▶ inference/  (engine)
 AIInterview /          │  knowledge.ts   admin.ts    │    knowledge/  (RAG)
 AICareer / AdminAI     │  + aiRateLimit middleware   │    prompts/    (templates)
                       └──────────────┬───────────────┘    analysis/   (code grading)
                                      │                      evaluation/ (MLOps)
                                      ▼
                            Postgres (Replit-managed)
                     ai_conversations · ai_messages · ai_knowledge_chunks
                     ai_models · ai_prompt_templates · ai_model_evaluations
                     ai_audit_logs · ai_feedback · ai_usage_metrics
                                      │
                                      ▼ (optional, self-hosted)
                         Local model server (Ollama-compatible),
                         reachable at AI_MODEL_ENDPOINT
```

**Two operating modes, chosen automatically at request time** (see
`lib/ai-engine/src/inference/index.ts`):

1. **`local_model`** — if `AI_MODEL_ENDPOINT` is set and reachable
   (`GET {endpoint}/api/tags` succeeds), every AI request streams from that
   self-hosted model server. Any Ollama-compatible server works — Ollama
   itself, or llama.cpp's server mode, running on hardware you control
   (a Replit VM with a model pulled via `ollama pull`, or an on-prem GPU box
   reachable from this container). Nothing about the request path talks to a
   vendor cloud API; `AI_MODEL_ENDPOINT` never points anywhere but
   infrastructure you operate.
2. **`built_in_rag`** (default, zero extra setup) — if no local model server
   is configured/reachable, every AI feature is served by the **built-in
   retrieval + template engine** (`lib/ai-engine/src/knowledge/retrieval.ts`
   + `lib/ai-engine/src/prompts/index.ts`). This is not a stub: it does real
   hybrid lexical+semantic search over indexed course content and composes
   grounded, mode-specific responses from it. It's what ships and runs today
   with no GPU, no downloaded weights, and no network calls.

Admins see which mode is active and can switch by setting `AI_MODEL_ENDPOINT`
via `GET /api/ai/admin/status` (surfaced in `AdminAI.tsx`).

## 2. Knowledge base & RAG (hybrid retrieval)

`lib/ai-engine/src/knowledge/`

- **Ingestion** (`index.ts`): `indexDocument()` chunks source text (lessons,
  challenges, docs) into ~800-character windows with 100-char overlap,
  dedupes via SHA-256 content hash, and computes two representations per
  chunk, stored in `ai_knowledge_chunks`:
  - `tfidfVector` — sparse term-frequency vector for exact/near-exact term
    matching (via BM25 at query time).
  - `embedding` — a 256-dimension dense vector from a **self-hosted local
    embedder** (`embeddings.ts`, the "hashing trick" / feature hashing
    technique used by systems like Vowpal Wabbit and fastText). It hashes
    words *and* character 3-grams into signed buckets and L2-normalises the
    result. This needs no model download and runs in microseconds, while
    still capturing sub-word similarity that pure keyword matching misses
    (e.g. "debugging" ↔ "debug", "loop forever" ↔ "infinite iteration").
- **Retrieval** (`retrieval.ts`): `searchKnowledge(query)` runs a **hybrid**
  search — Postgres `ILIKE` candidate recall + BM25 re-ranking for lexical
  precision, blended 65/35 with cosine similarity over the dense embeddings
  for semantic recall — and returns the top-K chunks with lexical/semantic/
  combined scores.
- **Sync**: `POST /api/ai/knowledge/sync` (admin) re-indexes every lesson and
  challenge in the database. `POST /api/ai/knowledge/index` indexes an
  arbitrary document (e.g. uploaded course material). `GET
  /api/ai/knowledge/stats` reports chunk counts by source.
- **Swapping in a neural encoder later**: `embed()` has a single call
  signature (`text -> number[]`). If a real sentence-transformer becomes
  available to self-host in this environment (e.g. an ONNX model served
  in-process), only `embeddings.ts` needs to change — `retrieval.ts` and the
  schema are already vector-shaped.

## 3. Learning assistant (AI tutor)

`routes/ai/chat.ts`, prompt mode `tutor` in `prompts/index.ts`,
`AITutor.tsx`.

- Persistent conversations (`ai_conversations`, `ai_messages`) scoped per
  user and per mode.
- Every user message passes `sanitizeInput()` (prompt-injection and
  harmful-content pattern checks) before being sent to either the local
  model or the retrieval engine.
- Responses are streamed over SSE; retrieved knowledge chunks are appended
  as grounding context so answers cite real course material instead of
  hallucinating.
- Every turn is written to `ai_audit_logs`; users can leave feedback
  (`ai_feedback`) which feeds analytics and MLOps evaluation.

## 4. Coding assistant

`routes/ai/code.ts`, `lib/ai-engine/src/analysis/index.ts`, `AITutor`/
`Workspace` code panels.

- `POST /ai/code/analyze` — instant, rule-based static analysis (no model
  call at all): nesting depth, comment ratio, duplicate-line detection,
  magic-number smells, dangerous `eval()` usage → numeric score + letter
  grade + issue list. Deterministic and free to run on every keystroke-pause.
- `POST /ai/code/explain` / `POST /ai/code/hint` — model-backed (local model
  or retrieval fallback), with `hint` explicitly designed to **never reveal
  a full answer** — the prompt template constrains it to Socratic nudges.
- `POST /ai/code/review` — streamed line-level review combining the static
  analyzer's findings with model commentary.

## 5. Assignment evaluation

`routes/ai/tools.ts` (`/ai/assignment/feedback`),
`analysis/index.ts::scoreAssignmentCode()`.

- Combines the same static-analysis signals used for the coding assistant
  with assignment-specific rubric context (requirements, expected patterns)
  pulled from the knowledge base, producing a score and structured feedback
  without needing a human grader in the loop for the first pass. Human
  mentors still review before grades are finalized — this is a fast,
  consistent first pass, not an autograder of record.

## 6. Interview coach

`routes/ai/tools.ts` (`/ai/interview/question`, `/ai/interview/evaluate`),
prompt mode `interview`, `AIInterview.tsx`.

- Generates behavioral/technical questions scoped to the learner's track
  and level (drawn from their course/cohort data).
- Evaluates spoken/typed answers against a rubric embedded in the prompt
  template, returning structured strengths/gaps feedback.

## 7. Personalized learning

`routes/ai/tools.ts` (`/ai/learning/path`, `/ai/learning/insights`),
`analysis/index.ts::generateLearningInsights()`.

- `generateLearningInsights()` is rule-based over real progress data
  (pass-rate trends, per-language gaps, submission velocity) — not
  model-generated, so it's fast, deterministic, and auditable.
- `/ai/learning/path` uses those insights plus knowledge-base retrieval to
  suggest next lessons/challenges suited to the learner's demonstrated gaps.

## 8. Career tools

`routes/ai/tools.ts` (`/ai/career/analyze`), prompt mode `career`,
`AICareer.tsx` — resume/profile analysis grounded in retrieved
career-readiness content from the knowledge base.

## 9. Content generation (staff-only)

`routes/ai/tools.ts` (`/ai/content/generate`) — restricted to
`admin`/`mentor` roles. Generates draft lesson content, quiz questions
(`/ai/quiz/generate`), or challenge prompts using the same engine, always
tagged as a draft for human review before publishing — this platform does
not auto-publish AI-authored course content.

## 10. Analytics

`routes/ai/admin.ts` (`/ai/admin/analytics`, `/ai/admin/metrics`), backed by
`ai_usage_metrics` and `ai_feedback`. Tracks token/latency usage per mode and
per model, and aggregates thumbs-up/down feedback so staff can see which
modes/prompt templates are underperforming.

## 11. Admin tooling

`AdminAI.tsx` + `routes/ai/admin.ts`:

- **Model registry** (`ai_models`): register/activate/deactivate self-hosted
  model endpoints; each has a `version` used to key MLOps evaluation runs.
- **Prompt template CRUD** (`ai_prompt_templates`): edit the system prompts
  driving each mode without a code deploy.
- **Audit log viewer** (`ai_audit_logs`): every AI request, safety block, and
  rate-limit hit, filterable per user/event.
- **Evaluation runner** (new — see §12): trigger and review MLOps eval runs
  per model.

## 12. MLOps — versioning & evaluation

`lib/ai-engine/src/evaluation/index.ts`, `ai_model_evaluations` table,
`POST /api/ai/admin/models/:id/evaluate`, `GET
/api/ai/admin/models/:id/evaluations`.

- `ai_models.version` is bumped whenever a model's weights/endpoint/config
  changes.
- `runEvalSuite()` runs a **fixed suite of representative prompts** (one per
  mode: tutor/code/assignment/interview/quiz) against whichever engine is
  currently active, and grades each response with cheap deterministic
  heuristics — minimum length, required-keyword coverage, latency budget.
  No external grading API is used.
- Results (pass rate, avg latency, avg output tokens, per-case detail) are
  stored per model+version in `ai_model_evaluations`, giving a comparable
  history across model swaps — a lightweight continuous-evaluation gate:
  run the suite after registering a new local model before promoting it to
  default, and compare its score against the previous version.
- **Fine-tuning / training**: this container has no GPU, so full model
  training is out of scope for in-app automation. The designed workflow for
  a self-hosted fine-tune is: export `ai_feedback` + curated
  `ai_conversations` as a training set → fine-tune externally with your own
  hardware (e.g. via an Ollama `Modelfile` + LoRA adapter, or llama.cpp
  fine-tuning tooling) → register the resulting model in `ai_models` with a
  new endpoint/version → run the evaluation suite before promoting it to
  `isDefault`. This keeps every trained artifact and its serving endpoint
  fully self-hosted; only the (optional, one-time, offline) training step
  happens outside this container.

## 13. Security

- **Prompt-injection / harmful-content filtering**: `sanitizeInput()` in
  `prompts/index.ts` runs on every user message before it reaches the model
  or retrieval engine, and blocked attempts are audit-logged
  (`ai_audit_logs`, event `unsafe_input_blocked`).
- **Rate limiting / abuse detection**: `aiRateLimit()` middleware
  (`artifacts/api-server/src/middlewares/aiRateLimit.ts`) caps each
  authenticated user to 30 AI requests/minute across `/api/ai/*` (admin
  routes exempt). Every block is written to `ai_audit_logs` as
  `rate_limit_hit` so abuse patterns are visible in the admin dashboard.
  Runs in-process (no external rate-limit service) — if the API server is
  scaled to multiple instances, replace the in-memory `Map` with a shared
  store (Postgres table or Redis) so limits are enforced across instances.
- **Role scoping**: content-generation and all admin endpoints require
  `admin`/`mentor` roles via `requireRole()`.
- **No data leaves the project**: retrieval, embeddings, static analysis,
  and (in `built_in_rag` mode) response generation all run against this
  project's own Postgres and process memory. In `local_model` mode, traffic
  only ever goes to `AI_MODEL_ENDPOINT`, which must point at infrastructure
  you operate — never a third-party inference API.

## 14. Performance

- Static analysis and rule-based insights (grading, learning insights) are
  synchronous and sub-millisecond — no model round-trip needed for those
  features at all.
- Retrieval is bounded (candidate recall ≤50 rows, semantic re-rank ≤500
  rows) — appropriate for course-content scale; if the knowledge base grows
  far beyond that, add a `pgvector` index (not currently installed/required)
  or pre-filter by course/tag before the semantic scan.
- Model responses stream over SSE so the UI shows tokens as they're
  produced rather than blocking on a full completion, in both engine modes.
- The Ollama-compatible client in `inference/index.ts` pings the local
  endpoint once per engine construction (not per request) to decide the
  serving mode, keeping the hot path free of an extra network round-trip.

## Where things live (quick index)

| Area | Path |
|---|---|
| Inference engine | `lib/ai-engine/src/inference/` |
| Knowledge/RAG | `lib/ai-engine/src/knowledge/` |
| Prompts & safety | `lib/ai-engine/src/prompts/` |
| Static code analysis | `lib/ai-engine/src/analysis/` |
| MLOps evaluation | `lib/ai-engine/src/evaluation/` |
| DB schema | `lib/db/src/schema/ai.ts` |
| API routes | `artifacts/api-server/src/routes/ai/` |
| Rate limiting | `artifacts/api-server/src/middlewares/aiRateLimit.ts` |
| Frontend | `artifacts/joe-hub/src/pages/ai/`, `AdminAI.tsx` |
