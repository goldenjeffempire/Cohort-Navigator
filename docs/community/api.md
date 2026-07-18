# Phase 5 API Reference

All endpoints require a valid Clerk auth token (`Authorization: Bearer <token>`).
`[admin]` = admin role required. `[mentor+]` = mentor or admin role required.

---

## Communities

| Method | Path | Description |
|---|---|---|
| GET | `/api/communities` | List all communities |
| POST | `/api/communities` | Create community [admin] |
| GET | `/api/communities/:id` | Get community |
| PATCH | `/api/communities/:id` | Update community [admin] |
| POST | `/api/communities/:id/join` | Join community |
| POST | `/api/communities/:id/leave` | Leave community |
| GET | `/api/communities/:id/members` | List members |
| PATCH | `/api/communities/:id/members/:userId` | Update member role [admin] |
| GET | `/api/communities/:id/leaderboard` | Community leaderboard |

## Badges

| Method | Path | Description |
|---|---|---|
| GET | `/api/badges` | List all badges |
| POST | `/api/badges` | Create badge [admin] |
| GET | `/api/badges/mine` | My earned badges |
| POST | `/api/badges/award` | Award badge to user [admin] |

## Discussions

| Method | Path | Description |
|---|---|---|
| GET | `/api/discussions` | List threads (query: communityId, category, search, isQuestion, limit, offset) |
| POST | `/api/discussions` | Create thread |
| GET | `/api/discussions/:id` | Get thread |
| PATCH | `/api/discussions/:id` | Update thread |
| DELETE | `/api/discussions/:id` | Delete thread |
| GET | `/api/discussions/:id/posts` | List posts |
| POST | `/api/discussions/:id/posts` | Create post |
| PATCH | `/api/discussions/:id/posts/:postId` | Update post |
| DELETE | `/api/discussions/:id/posts/:postId` | Delete post |
| POST | `/api/discussions/reactions` | Add/toggle reaction |
| DELETE | `/api/discussions/reactions/:id` | Remove reaction |

## Messaging

| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations` | List my conversations |
| POST | `/api/conversations` | Create DM or group |
| GET | `/api/conversations/:id` | Get conversation + participants |
| PATCH | `/api/conversations/:id` | Update group title |
| POST | `/api/conversations/:id/participants` | Add participant |
| DELETE | `/api/conversations/:id/participants/:userId` | Remove/leave |
| GET | `/api/conversations/:id/messages` | Paginated history |
| POST | `/api/conversations/:id/messages` | Send message |
| DELETE | `/api/conversations/:id/messages/:msgId` | Soft-delete message |
| GET | `/api/conversations/:id/events` | **SSE stream** (text/event-stream) |
| GET | `/api/presence?userIds=1,2,3` | Get presence for users |
| PUT | `/api/presence` | Update own presence status |

### SSE Event Types

```json
{ "type": "message", "data": { /* Message object */ } }
{ "type": "deleted", "data": { "id": 42 } }
```

## Mentorship

| Method | Path | Description |
|---|---|---|
| GET | `/api/mentors` | List mentor profiles |
| GET | `/api/mentors/me` | My mentor profile |
| POST | `/api/mentors` | Create mentor profile [mentor+] |
| PATCH | `/api/mentors/me` | Update my profile [mentor+] |
| GET | `/api/mentors/:userId` | Get mentor profile |
| GET | `/api/mentors/:userId/availability` | List availability slots |
| POST | `/api/mentors/:userId/availability` | Add slot [mentor+] |
| DELETE | `/api/mentors/:userId/availability/:slotId` | Delete slot [mentor+] |
| POST | `/api/mentors/:userId/sessions` | Book session |
| GET | `/api/sessions/mine` | My sessions |
| GET | `/api/sessions/:id` | Get session |
| PATCH | `/api/sessions/:id` | Update session status |
| DELETE | `/api/sessions/:id` | Cancel session |
| POST | `/api/sessions/:id/feedback` | Submit feedback |
| GET | `/api/sessions/:id/feedback` | Get session feedback |

## Teams

| Method | Path | Description |
|---|---|---|
| GET | `/api/teams` | List teams (query: cohortId, kind, mine) |
| POST | `/api/teams` | Create team |
| GET | `/api/teams/:id` | Get team + members |
| PATCH | `/api/teams/:id` | Update team |
| DELETE | `/api/teams/:id` | Delete team |
| GET | `/api/teams/:id/members` | List members |
| PATCH | `/api/teams/:id/members/:userId` | Update member role |
| DELETE | `/api/teams/:id/members/:userId` | Remove member |
| GET | `/api/teams/:id/tasks` | List tasks |
| POST | `/api/teams/:id/tasks` | Create task |
| PATCH | `/api/teams/tasks/:taskId` | Update task |
| DELETE | `/api/teams/tasks/:taskId` | Delete task |
| GET | `/api/teams/:id/resources` | List resources |
| POST | `/api/teams/:id/resources` | Add resource |
| DELETE | `/api/teams/:id/resources/:resourceId` | Remove resource |
| POST | `/api/teams/:id/invitations` | Invite member |
| GET | `/api/invitations/mine` | My pending invitations |
| POST | `/api/teams/invitations/:id/accept` | Accept invitation |
| POST | `/api/teams/invitations/:id/decline` | Decline invitation |

## Live Sessions

| Method | Path | Description |
|---|---|---|
| GET | `/api/live-sessions` | List sessions (query: type, upcoming, cohortId) |
| POST | `/api/live-sessions` | Create session [mentor+] |
| GET | `/api/live-sessions/:id` | Get session + myRsvp |
| PATCH | `/api/live-sessions/:id` | Update session |
| DELETE | `/api/live-sessions/:id` | Delete session |
| POST | `/api/live-sessions/:id/rsvp` | Upsert RSVP (going/interested/declined) |
| DELETE | `/api/live-sessions/:id/rsvp` | Remove RSVP |
| GET | `/api/live-sessions/:id/rsvps` | List RSVPs |
| POST | `/api/live-sessions/:id/attendance` | Mark attendance [mentor+] |
| GET | `/api/live-sessions/:id/attendance` | List attendance [mentor+] |

## Integrations (Admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/integrations` | List integration configs |
| POST | `/api/integrations` | Create / upsert config |
| PATCH | `/api/integrations/:id` | Update config |
| DELETE | `/api/integrations/:id` | Delete config |
| POST | `/api/integrations/:id/test` | Send test webhook notification |
| GET | `/api/integrations/sync-logs` | Get sync log entries |

## Moderation

| Method | Path | Description |
|---|---|---|
| GET | `/api/reports` | List content reports (query: status) |
| POST | `/api/reports` | Submit report |
| PATCH | `/api/reports/:id` | Resolve/dismiss report [admin] |
| GET | `/api/suspensions` | List suspensions [admin] |
| POST | `/api/suspensions` | Suspend user [admin] |
| DELETE | `/api/suspensions/:id` | Lift suspension [admin] |
| GET | `/api/community-audit-logs` | Get audit log [admin] |
