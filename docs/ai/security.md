# AI Security

## Threat Model

JOE Forge's AI platform faces four primary threat categories:

| Threat | Description | Risk |
|--------|-------------|------|
| Prompt injection | User crafts input to override system instructions | Medium — could bypass tutoring guardrails |
| Abuse / DoS | Bulk requests exhaust server resources | Medium — rate limiting mitigates |
| Content policy violation | Requests for harmful technical content | Low — pattern matching blocks most cases |
| Data exfiltration | Attempts to extract PII via AI | Low — no PII in model context; scrubbed from logs |

---

## Layer 1: Input Sanitisation

**File:** `lib/ai-engine/src/prompts/index.ts` — `sanitizeInput()`

Every user message passes through two filter stages before reaching inference:

### Prompt Injection Patterns (8 rules)

```
"ignore (all|previous|above|prior) instructions"
"you are now"
"act as (a|an|if)"
"forget (everything|your instructions|your training)"
"do anything now"
"jailbreak"
"override (your|all) instructions"
"system prompt"
"DAN mode"
```

### Harmful Content Patterns (3 rules)

```
"how to (hack|attack|exploit|ddos|bruteforce)"
"(write|create|generate) (malware|virus|ransomware|keylogger)"
"steal (credentials|passwords|data)"
```

**On detection:** Request is rejected with HTTP 400; event `prompt_injection_detected` or `content_flagged` is inserted into `ai_audit_logs` with the sanitised request summary (first 100 chars).

---

## Layer 2: Enhanced Content Safety Scoring

**File:** `lib/ai-engine/src/security/index.ts` — `scoreContentSafety()`

A 15-rule scoring system that assigns a risk score (0-100) and blocks requests above threshold 60:

| Category | Trigger | Score |
|----------|---------|-------|
| `prompt_injection` | Override/ignore instruction patterns | 70-80 |
| `jailbreak` | DAN mode, "do anything now" | 85-90 |
| `harmful_technical` | Hacking/attack tutorials | 90 |
| `malware` | Malware/virus code generation | 95 |
| `data_theft` | Credential/data theft | 90 |
| `sql_injection` | SQL injection attack payloads | 75 |
| `xss` | Cross-site scripting attack payloads | 70 |
| `pii_extraction` | Extracting user emails/passwords | 70 |
| `data_exfiltration` | Database dump requests | 75 |
| `academic_dishonesty` | "Complete my assignment" (graded) | 35-40 |

Academic dishonesty is scored lower (below the block threshold) — it is flagged for review but not blocked outright, since the AI is instructed to refuse anyway.

---

## Layer 3: Rate Limiting

**File:** `artifacts/api-server/src/middlewares/aiRateLimit.ts`

Applied to all `/api/ai/*` routes except admin endpoints (admins are exempt to allow model management).

| Configuration | Value |
|---------------|-------|
| Window | Per-request sliding window |
| Limit | Configurable via middleware options |
| Key | User ID (authenticated) |
| Response on limit | HTTP 429 with `Retry-After` header |
| Audit event | `rate_limit_hit` in `ai_audit_logs` |

### Abuse Detection

**File:** `lib/ai-engine/src/security/index.ts` — `assessAbuse()`

Per-user 1-minute sliding window tracking (in-process):

| Signal | Threshold | Action |
|--------|-----------|--------|
| Request burst | > 30/min | Block |
| High frequency | > 20/min | Throttle |
| Repeated identical payloads | > 80% same length | Throttle |
| Oversized payloads | > 3 msgs over 8000 chars | Throttle |

---

## Layer 4: Access Control

All AI routes require authentication via `requireAuth` middleware (Clerk session validation).

| Route group | Access |
|-------------|--------|
| `/api/ai/conversations/*` | Any authenticated user (own conversations only) |
| `/api/ai/code/*` | Any authenticated user |
| `/api/ai/interview/*`, `/ai/career/*` | Any authenticated user |
| `/api/ai/content/generate` | Admin and Mentor only |
| `/api/ai/knowledge/index` | Admin and Mentor only |
| `/api/ai/knowledge/sync`, `/stats` | Admin only |
| `/api/ai/admin/*` | Admin only |
| `/api/ai/analytics/cohort/*`, `/mentor/*` | Admin and Mentor |
| `/api/ai/analytics/student/:userId` | Own user, or Admin/Mentor |

---

## Layer 5: Audit Logging (`ai_audit_logs`)

Every significant AI event is logged with no PII in the stored content:

| Event | When |
|-------|------|
| `inference_request` | Every AI inference call begins |
| `inference_response` | Inference completes successfully |
| `knowledge_search` | Knowledge base search executed |
| `content_flagged` | Harmful content detected |
| `rate_limit_hit` | User hit rate limit |
| `prompt_injection_detected` | Injection pattern matched |
| `model_switch` | Active model changed by admin |
| `feedback_submitted` | User rated an AI response |

### Log Record

```typescript
{
  userId: 42,
  event: "prompt_injection_detected",
  conversationId: 7,
  requestSummary: "ignore previous instruct...",   // first 100 chars only
  responseStatus: "blocked",
  flagReason: "prompt_injection",
  ipAddress: "...",                                // from X-Forwarded-For
  metadata: { ... }
}
```

### PII Scrubbing

Before any content is written to audit logs, it passes through `scrubPII()`:

```
email@domain.com → [EMAIL]
555-123-4567     → [PHONE]
4111-1111-...    → [CARD]
password: abc123 → password:[REDACTED]
Bearer eyJ...    → bearer [REDACTED]
api_key: sk-...  → api_key:[REDACTED]
```

---

## Layer 6: Context Isolation

The AI model never has access to:
- Other users' conversation history
- Full database contents
- API keys or server-side secrets
- System configuration

The system prompt is constructed server-side from sanitised, parameterised templates. User-supplied content is inserted in the *user* message position — never the system prompt — preventing privilege escalation.

---

## Security Monitoring

```
GET /api/ai/admin/audit         → full audit log (last 50-200 events)
GET /api/ai/admin/analytics     → flagged count, block rate
GET /api/ai/admin/status        → engine status, usage counts
```

### Alerting Triggers (Manual)

Review the audit log when:
- `flaggedCount` spikes > 10x baseline in a single day
- `prompt_injection_detected` events appear from the same user repeatedly
- `rate_limit_hit` events concentrate on one user within an hour
- Average AI rating drops below 2.5/5 (model quality regression)

---

## Responsible AI Principles

1. **Academic integrity**: The `code` and `assignment` modes explicitly refuse to complete graded work. The system prompt instructs the AI to guide, not solve.
2. **Transparency**: RAG-retrieved content is tagged with its source chunk IDs (`retrieved_chunks` column in `ai_messages`) for auditability.
3. **No data training**: Student conversations are stored only for UX (history display) and monitoring. They are never sent to external services.
4. **Student privacy**: AI analytics are de-identified where possible (top/struggling performer lists use IDs only, not names, in API responses).
