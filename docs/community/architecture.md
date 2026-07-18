# Phase 5 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Joe Hub Frontend                         │
│  React + Vite + Tailwind + shadcn/ui + TanStack Query        │
│                                                              │
│  Pages (Wouter routes)         Hooks (src/lib/community.ts)  │
│  ├── /community                ├── useCommunities()          │
│  ├── /community/:id            ├── useDiscussions()          │
│  ├── /discussions              ├── useConversations()        │
│  ├── /discussions/:id          ├── useMessages()             │
│  ├── /discussions/new          ├── useMentors()              │
│  ├── /messages      ←──SSE──   ├── useLiveSessions()        │
│  ├── /mentorship               ├── useTeams()                │
│  ├── /mentorship/:userId       ├── useIntegrations()         │
│  ├── /teams                    └── ...                       │
│  ├── /teams/:id                                              │
│  ├── /events                                                 │
│  ├── /admin/community                                        │
│  ├── /admin/moderation                                       │
│  └── /admin/integrations                                     │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST + SSE  (BASE_URL/api/*)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                     API Server (Express 5)                   │
│  artifacts/api-server/src/routes/                            │
│                                                              │
│  community/      communities, badges, leaderboard            │
│  discussions/    threads, posts, reactions                   │
│  messaging/      conversations, messages, SSE, presence      │
│  mentorship/     profiles, availability, sessions, feedback  │
│  teams/          teams, members, tasks, resources, invites   │
│  live-learning/  sessions, rsvps, attendance                 │
│  integrations/   config, test, sync-logs                     │
│  moderation/     reports, suspensions, audit-logs            │
└───────────────────────────┬──────────────────────────────────┘
                            │ Drizzle ORM
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Replit DB)                   │
│                                                              │
│  communities          community_members     badges           │
│  user_badges          discussion_threads    discussion_posts  │
│  discussion_reactions discussion_attachments                 │
│  conversations        conversation_participants              │
│  messages             message_reads         user_presence    │
│  mentor_profiles      mentor_availability_slots              │
│  mentoring_sessions   mentoring_session_participants         │
│  session_feedback     teams                 team_members     │
│  team_invitations     team_tasks            team_resources   │
│  live_sessions        live_session_rsvps    live_session_attendance│
│  content_reports      user_suspensions      community_audit_logs   │
│  community_integrations  integration_sync_logs               │
└──────────────────────────────────────────────────────────────┘
                            │ Webhooks (outbound fetch)
                            ▼
            ┌───────────┐     ┌─────────────┐
            │  Discord  │     │    Slack     │
            │ Incoming  │     │  Incoming   │
            │ Webhook   │     │  Webhook    │
            └───────────┘     └─────────────┘
```

## SSE Real-Time Messaging Flow

```
Client A                API Server                     Client B
   │                        │                              │
   │ GET /conversations/5/events ──────────────────────────│
   │                        │←─ SSE registered (Set<Res>)  │
   │                        │                              │
   │ POST /conversations/5/messages                        │
   │  {body: "Hello!"}       │                              │
   │                        │──── broadcast to all ────────→│
   │                        │    "data: {type:message,...}" │
   │←── 201 message ─────────│                              │
```

## Auth Middleware

All Phase 5 routes use:
- `requireAuth` — verifies Clerk JWT, loads DB user, attaches `req.user`
- `requireRole("admin")` — admin-only routes
- `requireRole("mentor", "admin")` — mentor or admin routes
