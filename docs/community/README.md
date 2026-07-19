# Phase 5 — Community, Collaboration & Mentorship

## Overview

Phase 5 adds a complete social and collaborative layer to the JOE Forge platform:

| Feature | Routes | Description |
|---|---|---|
| Community management | `/api/communities/*` | Create/join/leave communities, member roles, badges, leaderboards |
| Threaded discussions | `/api/discussions/*` | Q&A threads, emoji reactions, categories, pin/lock |
| Real-time messaging | `/api/conversations/*` | DMs and group chats with SSE streaming |
| Mentorship | `/api/mentors/*`, `/api/sessions/*` | Book 1:1 or group sessions, availability, feedback |
| Teams | `/api/teams/*` | Project teams & study groups, kanban tasks, resources |
| Live learning | `/api/live-sessions/*` | Classes, webinars, hackathons, RSVPs, attendance |
| Integrations | `/api/integrations/*` | Discord & Slack incoming webhook sync |
| Moderation | `/api/reports/*`, `/api/suspensions/*` | Content reports, user suspensions, audit log |

## Architecture

See [architecture.md](./architecture.md) for a full layer diagram.

## Key Design Decisions

### Real-Time Messaging (SSE only)

Messages use **Server-Sent Events** (SSE) — no WebSocket/ws package. A module-level `Map<conversationId, Set<Response>>` in `routes/messaging/messages.ts` holds open SSE response objects. When a message is sent via `POST /conversations/:id/messages`, it is immediately broadcast to all open SSE clients for that conversation. Keepalive comments are sent every 20 seconds to prevent proxy timeouts.

Frontend connects via:
```ts
new EventSource(`${import.meta.env.BASE_URL}/api/conversations/${id}/events`)
```

### Discord / Slack — Incoming Webhooks Only

No OAuth is required. Admins paste an **incoming webhook URL** into the `channelMap.webhook` field. The `POST /integrations/:id/test` endpoint sends a test payload to that URL using `fetch()`. The credential (webhook URL) lives in the `channel_map` JSONB column, so no separate secrets table is needed.

### Mentorship Booking

Mentors configure recurring availability slots (`mentor_availability_slots`) with `dayOfWeek` (0–6) and `startMinute`/`endMinute` (minutes from midnight). Students pick a slot and submit a `POST /mentors/:userId/sessions` request. Sessions support both `one_on_one` and `group` formats with optional `mentoringSessionParticipants`.

### Teams

Teams belong to a cohort and are typed as `project` or `study_group`. The team lead can invite members (via `teamInvitationsTable`), manage tasks (kanban with `todo → in_progress → done`), and share resources (links or object storage paths).

## Pages & Routes

| Page | Route | Role |
|---|---|---|
| CommunityHub | `/community` | All authenticated |
| CommunityPage | `/community/:id` | All authenticated |
| DiscussionsList | `/discussions` | All authenticated |
| DiscussionDetail | `/discussions/:id` | All authenticated |
| CreateDiscussion | `/discussions/new` | All authenticated |
| MessagesPage | `/messages` | All authenticated |
| MentorDirectory | `/mentorship` | All authenticated |
| MentorProfile | `/mentorship/:userId` | All authenticated |
| TeamsPage | `/teams` | All authenticated |
| TeamWorkspace | `/teams/:id` | Team members |
| EventsPage | `/events` | All authenticated |
| AdminCommunity | `/admin/community` | Admin only |
| AdminModeration | `/admin/moderation` | Admin only |
| AdminIntegrations | `/admin/integrations` | Admin only |
