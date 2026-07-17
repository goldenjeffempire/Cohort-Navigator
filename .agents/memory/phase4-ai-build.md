---
name: Phase 4 AI build decisions
description: Key decisions made while building Phase 4 of JOE Hub — native AI ecosystem (adaptive learning, analytics, caching, security, docs)
---

# Phase 4 AI Build Decisions

## customFetch export gap
`@workspace/api-client-react` did NOT export `customFetch` from its `src/index.ts` — only `setBaseUrl` and `setAuthTokenGetter` were re-exported from `custom-fetch.ts`. The generated orval hooks (useGetMe etc) work because they import internally, but any component trying to call APIs outside generated hooks fails.

**Fix applied:** Added `customFetch` and `CustomFetchOptions` to the package's `src/index.ts` export.

**Why:** The existing `lib/ai.ts` already imported `customFetch` from `@workspace/api-client-react`, but the AI pages (AIHub, AITutor, etc.) were never wired in App.tsx before Phase 4, so the bad import never triggered. Wiring `/ai/*` routes in App.tsx surfaced the missing export.

## AI pages were never routed before Phase 4
`AIHub.tsx`, `AITutor.tsx`, `AICareer.tsx`, `AIInterview.tsx` existed but were not in `App.tsx` routing. All Phase 4 work wired them in and confirmed `customFetch` export was needed.

## DB schema append pattern
New Phase 4 tables (`ai_learning_profiles`, `ai_skill_assessments`, `ai_interview_sessions`, `ai_content_generations`) were appended to the existing `lib/db/src/schema/ai.ts` file. The schema index uses `export * from "./ai"` so no index update needed.

## ai-engine package exports
New modules (`learning/adaptive`, `analytics/index`, `cache/index`, `security/index`) added to `lib/ai-engine/package.json` exports AND to `lib/ai-engine/src/index.ts`. Both must be updated when adding new submodules.

## pages/admin directory was absent
`artifacts/joe-hub/src/pages/admin/` did not exist before Phase 4. Created with `AdminAI.tsx`.

## Interview sessions require non-streaming complete()
The `POST /ai/interview/session/start` and answer submission endpoints needed synchronous responses (question text must be stored in DB and returned as JSON). Used `inferenceEngine.complete()` not `inferenceEngine.stream()` for these.
