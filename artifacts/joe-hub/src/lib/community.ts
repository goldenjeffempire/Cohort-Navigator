/**
 * Phase 5 — Community, Collaboration & Mentorship API hooks
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Community {
  id: number;
  kind: "global" | "cohort";
  cohortId: number | null;
  name: string;
  description: string | null;
  guidelines: string | null;
  createdAt: string;
  memberCount?: number;
}

export interface CommunityMember {
  id: number;
  communityId: number;
  userId: number;
  role: "member" | "moderator" | "admin";
  isSuspended: boolean;
  joinedAt: string;
  name: string;
  avatarUrl: string | null;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  createdAt: string;
}

export interface DiscussionThread {
  id: number;
  communityId: number;
  authorId: number;
  category: string;
  title: string;
  body: string;
  isQuestion: boolean;
  isResolved: boolean;
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  postCount?: number;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  acceptedPostId?: number | null;
}

export interface DiscussionPost {
  id: number;
  threadId: number;
  authorId: number;
  parentPostId: number | null;
  body: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
}

export interface Conversation {
  id: number;
  kind: "dm" | "group" | "cohort_room" | "team_room";
  title: string | null;
  createdAt: string;
  latestMessage?: { id: number; body: string; createdAt: string } | null;
  unreadCount?: number;
  participantCount?: number;
  participants?: ConversationParticipant[];
}

export interface ConversationParticipant {
  id: number;
  userId: number;
  isMuted: boolean;
  joinedAt: string;
  name: string;
  avatarUrl: string | null;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  isDeleted: boolean;
  createdAt: string;
  senderName: string;
  senderAvatarUrl: string | null;
}

export interface MentorProfile {
  userId: number;
  headline: string | null;
  expertise: string | null;
  bio: string | null;
  timezone: string;
  isAcceptingBookings: boolean;
  name?: string;
  avatarUrl?: string | null;
}

export interface MentoringSession {
  id: number;
  mentorId: number;
  studentId: number | null;
  cohortId: number | null;
  format: "one_on_one" | "group";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  topic: string | null;
  startsAt: string;
  endsAt: string;
  meetingLink: string | null;
  recordingUrl: string | null;
  mentorName?: string;
}

export interface Team {
  id: number;
  cohortId: number;
  kind: "project" | "study_group";
  name: string;
  description: string | null;
  createdAt: string;
  memberCount?: number;
  members?: TeamMember[];
}

export interface TeamMember {
  id: number;
  userId: number;
  role: "lead" | "member";
  joinedAt: string;
  userName?: string;
  userAvatarUrl?: string | null;
}

export interface TeamTask {
  id: number;
  teamId: number;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  assigneeId: number | null;
  dueDate: string | null;
  createdAt: string;
}

export interface TeamResource {
  id: number;
  teamId: number;
  addedById: number;
  title: string;
  url: string | null;
  objectPath: string | null;
  createdAt: string;
}

export interface TeamInvitation {
  id: number;
  teamId: number;
  invitedUserId: number;
  status: string;
  createdAt: string;
  teamName?: string;
  teamKind?: string;
  inviterName?: string;
  inviteeName?: string;
  inviteeEmail?: string;
}

export interface LiveSession {
  id: number;
  cohortId: number | null;
  type: string;
  status: string;
  title: string;
  description: string | null;
  hostId: number | null;
  startsAt: string;
  endsAt: string;
  meetingLink: string | null;
  recordingUrl: string | null;
  relatedChallengeIds: string | null;
  createdAt: string;
  hostName?: string | null;
  rsvpCount?: number;
  myRsvp?: string | null;
}

export interface CommunityIntegration {
  id: number;
  cohortId: number | null;
  provider: "discord" | "slack";
  isEnabled: boolean;
  externalWorkspaceId: string | null;
  channelMap: Record<string, string> | null;
  syncAnnouncements: boolean;
  syncAssignments: boolean;
  syncEventReminders: boolean;
  updatedAt: string;
}

export interface SyncLog {
  id: number;
  integrationId: number;
  event: string;
  status: "success" | "failed";
  detail: string | null;
  createdAt: string;
}

// ─── Community hooks ──────────────────────────────────────────────────────────

export function useCommunities() {
  return useQuery<Community[]>({
    queryKey: ["communities"],
    queryFn: () => customFetch("/api/communities"),
  });
}

export function useCommunity(id: number) {
  return useQuery<Community>({
    queryKey: ["communities", id],
    queryFn: () => customFetch(`/api/communities/${id}`),
    enabled: !!id,
  });
}

export function useJoinCommunity() {
  const qc = useQueryClient();
  return useMutation<CommunityMember, Error, number>({
    mutationFn: (communityId) =>
      customFetch(`/api/communities/${communityId}/join`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useLeaveCommunity() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (communityId) =>
      customFetch(`/api/communities/${communityId}/leave`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useCommunityMembers(communityId: number) {
  return useQuery<CommunityMember[]>({
    queryKey: ["communities", communityId, "members"],
    queryFn: () => customFetch(`/api/communities/${communityId}/members`),
    enabled: !!communityId,
  });
}

export function useBadges() {
  return useQuery<Badge[]>({
    queryKey: ["badges"],
    queryFn: () => customFetch("/api/badges"),
  });
}

export function useMyBadges() {
  return useQuery<Badge[]>({
    queryKey: ["badges", "mine"],
    queryFn: () => customFetch("/api/badges/mine"),
  });
}

export function useLeaderboard(communityId: number) {
  return useQuery({
    queryKey: ["leaderboard", communityId],
    queryFn: () => customFetch(`/api/communities/${communityId}/leaderboard`),
    enabled: !!communityId,
  });
}

// ─── Discussion hooks ─────────────────────────────────────────────────────────

export function useDiscussions(params: {
  communityId: number;
  category?: string;
  search?: string;
  isQuestion?: boolean;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("communityId", String(params.communityId));
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  if (params.isQuestion !== undefined) qs.set("isQuestion", String(params.isQuestion));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));

  return useQuery<DiscussionThread[]>({
    queryKey: ["discussions", params],
    queryFn: () => customFetch(`/api/discussions?${qs.toString()}`),
    enabled: !!params.communityId,
  });
}

export function useDiscussion(id: number) {
  return useQuery<DiscussionThread>({
    queryKey: ["discussions", id],
    queryFn: () => customFetch(`/api/discussions/${id}`),
    enabled: !!id,
  });
}

export function useDiscussionPosts(threadId: number) {
  return useQuery<DiscussionPost[]>({
    queryKey: ["discussions", threadId, "posts"],
    queryFn: () => customFetch(`/api/discussions/${threadId}/posts`),
    enabled: !!threadId,
  });
}

export function useCreateDiscussion() {
  const qc = useQueryClient();
  return useMutation<DiscussionThread, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      customFetch("/api/discussions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discussions"] }),
  });
}

export function useCreatePost(threadId: number) {
  const qc = useQueryClient();
  return useMutation<DiscussionPost, Error, { body: string; parentPostId?: number }>({
    mutationFn: (data) =>
      customFetch(`/api/discussions/${threadId}/posts`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discussions", threadId, "posts"] }),
  });
}

export function useReactToThread() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { threadId?: number; postId?: number; emoji: string }>({
    mutationFn: (data) =>
      customFetch("/api/discussions/reactions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discussions"] }),
  });
}

export function useUpdateDiscussion() {
  const qc = useQueryClient();
  return useMutation<DiscussionThread, Error, { id: number; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      customFetch(`/api/discussions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ["discussions", id] }),
  });
}

export function useDeleteDiscussion() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => customFetch(`/api/discussions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discussions"] }),
  });
}

// ─── Messaging hooks ──────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => customFetch("/api/conversations"),
    refetchInterval: 15_000,
  });
}

export function useConversation(id: number) {
  return useQuery<Conversation>({
    queryKey: ["conversations", id],
    queryFn: () => customFetch(`/api/conversations/${id}`),
    enabled: !!id,
  });
}

export function useMessages(conversationId: number) {
  return useQuery<Message[]>({
    queryKey: ["messages", conversationId],
    queryFn: () => customFetch(`/api/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: number) {
  const qc = useQueryClient();
  return useMutation<Message, Error, { body: string }>({
    mutationFn: (data) =>
      customFetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation<
    Conversation,
    Error,
    { kind: "dm" | "group"; participantIds: number[]; title?: string }
  >({
    mutationFn: (data) =>
      customFetch("/api/conversations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function usePresence(userIds: number[]) {
  return useQuery({
    queryKey: ["presence", userIds],
    queryFn: () => customFetch(`/api/presence?userIds=${userIds.join(",")}`),
    enabled: userIds.length > 0,
    refetchInterval: 30_000,
  });
}

export function useSetPresence() {
  return useMutation<unknown, Error, { status: "online" | "away" | "offline" }>({
    mutationFn: (data) =>
      customFetch("/api/presence", { method: "PUT", body: JSON.stringify(data) }),
  });
}

// ─── Mentorship hooks ─────────────────────────────────────────────────────────

export function useMentors() {
  return useQuery<MentorProfile[]>({
    queryKey: ["mentors"],
    queryFn: () => customFetch("/api/mentors"),
  });
}

export function useMentorProfile(userId: number) {
  return useQuery<MentorProfile>({
    queryKey: ["mentors", userId],
    queryFn: () => customFetch(`/api/mentors/${userId}`),
    enabled: !!userId,
  });
}

export function useMentorAvailability(userId: number) {
  return useQuery({
    queryKey: ["mentors", userId, "availability"],
    queryFn: () => customFetch(`/api/mentors/${userId}/availability`),
    enabled: !!userId,
  });
}

export function useBookSession() {
  const qc = useQueryClient();
  return useMutation<
    MentoringSession,
    Error,
    { mentorId: number; format: string; topic?: string; startsAt: string; endsAt: string }
  >({
    mutationFn: ({ mentorId, ...data }) =>
      customFetch(`/api/mentors/${mentorId}/sessions`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useMyMentoringSessions() {
  return useQuery<MentoringSession[]>({
    queryKey: ["sessions", "mine"],
    queryFn: () => customFetch("/api/sessions/mine"),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation<MentoringSession, Error, { id: number; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      customFetch(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useSessionFeedback(sessionId: number) {
  return useQuery({
    queryKey: ["sessions", sessionId, "feedback"],
    queryFn: () => customFetch(`/api/sessions/${sessionId}/feedback`),
    enabled: !!sessionId,
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { sessionId: number; rating: number; comment?: string; authorRole: string }
  >({
    mutationFn: ({ sessionId, ...data }) =>
      customFetch(`/api/sessions/${sessionId}/feedback`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: ["sessions", sessionId, "feedback"] }),
  });
}

// ─── Team hooks ───────────────────────────────────────────────────────────────

export function useTeams(params?: { cohortId?: number; kind?: string; mine?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.cohortId) qs.set("cohortId", String(params.cohortId));
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.mine) qs.set("mine", "true");

  return useQuery<Team[]>({
    queryKey: ["teams", params],
    queryFn: () => customFetch(`/api/teams?${qs.toString()}`),
  });
}

export function useTeam(id: number) {
  return useQuery<Team>({
    queryKey: ["teams", id],
    queryFn: () => customFetch(`/api/teams/${id}`),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation<Team, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      customFetch("/api/teams", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useTeamTasks(teamId: number) {
  return useQuery<TeamTask[]>({
    queryKey: ["teams", teamId, "tasks"],
    queryFn: () => customFetch(`/api/teams/${teamId}/tasks`),
    enabled: !!teamId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation<TeamTask, Error, { teamId: number; title: string; description?: string; assigneeId?: number; dueDate?: string }>({
    mutationFn: ({ teamId, ...data }) =>
      customFetch(`/api/teams/${teamId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, { teamId }) => qc.invalidateQueries({ queryKey: ["teams", teamId, "tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<TeamTask, Error, { teamId: number; taskId: number; data: Record<string, unknown> }>({
    mutationFn: ({ taskId, data }) =>
      customFetch(`/api/teams/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, { teamId }) => qc.invalidateQueries({ queryKey: ["teams", teamId, "tasks"] }),
  });
}

export function useTeamResources(teamId: number) {
  return useQuery<TeamResource[]>({
    queryKey: ["teams", teamId, "resources"],
    queryFn: () => customFetch(`/api/teams/${teamId}/resources`),
    enabled: !!teamId,
  });
}

export function useAddResource() {
  const qc = useQueryClient();
  return useMutation<TeamResource, Error, { teamId: number; title: string; url?: string }>({
    mutationFn: ({ teamId, ...data }) =>
      customFetch(`/api/teams/${teamId}/resources`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, { teamId }) => qc.invalidateQueries({ queryKey: ["teams", teamId, "resources"] }),
  });
}

export function useMyInvitations() {
  return useQuery<TeamInvitation[]>({
    queryKey: ["invitations", "mine"],
    queryFn: () => customFetch("/api/invitations/mine"),
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: (id) =>
      customFetch(`/api/teams/invitations/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: (id) =>
      customFetch(`/api/teams/invitations/${id}/decline`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

// ─── Live Learning hooks ──────────────────────────────────────────────────────

export function useLiveSessions(params?: {
  type?: string;
  upcoming?: boolean;
  cohortId?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.upcoming) qs.set("upcoming", "true");
  if (params?.cohortId) qs.set("cohortId", String(params.cohortId));

  return useQuery<LiveSession[]>({
    queryKey: ["live-sessions", params],
    queryFn: () => customFetch(`/api/live-sessions?${qs.toString()}`),
  });
}

export function useLiveSession(id: number) {
  return useQuery<LiveSession>({
    queryKey: ["live-sessions", id],
    queryFn: () => customFetch(`/api/live-sessions/${id}`),
    enabled: !!id,
  });
}

export function useCreateLiveSession() {
  const qc = useQueryClient();
  return useMutation<LiveSession, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      customFetch("/api/live-sessions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-sessions"] }),
  });
}

export function useRsvpSession() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { sessionId: number; status: string }>({
    mutationFn: ({ sessionId, status }) =>
      customFetch(`/api/live-sessions/${sessionId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-sessions"] }),
  });
}

export function useSessionRsvps(sessionId: number) {
  return useQuery({
    queryKey: ["live-sessions", sessionId, "rsvps"],
    queryFn: () => customFetch(`/api/live-sessions/${sessionId}/rsvps`),
    enabled: !!sessionId,
  });
}

// ─── Admin — Integrations hooks ───────────────────────────────────────────────

export function useIntegrations(cohortId?: number) {
  const qs = cohortId ? `?cohortId=${cohortId}` : "";
  return useQuery<CommunityIntegration[]>({
    queryKey: ["integrations", cohortId],
    queryFn: () => customFetch(`/api/integrations${qs}`),
  });
}

export function useUpsertIntegration() {
  const qc = useQueryClient();
  return useMutation<CommunityIntegration, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      customFetch("/api/integrations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function usePatchIntegration() {
  const qc = useQueryClient();
  return useMutation<CommunityIntegration, Error, { id: number; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      customFetch(`/api/integrations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useTestIntegration() {
  return useMutation<{ ok: boolean; detail: string }, Error, number>({
    mutationFn: (id) =>
      customFetch(`/api/integrations/${id}/test`, { method: "POST" }),
  });
}

export function useSyncLogs(integrationId?: number) {
  const qs = integrationId ? `?integrationId=${integrationId}` : "";
  return useQuery<SyncLog[]>({
    queryKey: ["sync-logs", integrationId],
    queryFn: () => customFetch(`/api/integrations/sync-logs${qs}`),
  });
}

// ─── Moderation hooks ─────────────────────────────────────────────────────────

export function useContentReports(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["reports", status],
    queryFn: () => customFetch(`/api/reports${qs}`),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: number; status: string; resolutionNote?: string }>({
    mutationFn: ({ id, ...data }) =>
      customFetch(`/api/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useSuspensions() {
  return useQuery({
    queryKey: ["suspensions"],
    queryFn: () => customFetch("/api/suspensions"),
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { userId: number; reason: string; expiresAt?: string }>({
    mutationFn: (data) =>
      customFetch("/api/suspensions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suspensions"] }),
  });
}

export function useCommunityAuditLogs() {
  return useQuery({
    queryKey: ["community-audit-logs"],
    queryFn: () => customFetch("/api/community-audit-logs"),
  });
}
