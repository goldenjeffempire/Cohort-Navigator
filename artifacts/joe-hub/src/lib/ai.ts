/**
 * AI Platform client hooks
 * Streaming uses fetch + ReadableStream (SSE); non-streaming uses React Query.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AIMode = "tutor" | "code" | "assignment" | "interview" | "career" | "quiz" | "review" | "general";

export interface AIConversation {
  id: number;
  userId: number;
  mode: AIMode;
  title: string;
  courseId?: number | null;
  lessonId?: number | null;
  challengeId?: number | null;
  assignmentId?: number | null;
  metadata?: Record<string, unknown> | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  createdAt: string;
}

export interface CodeQualityReport {
  score: number;
  grade: string;
  metrics: {
    linesOfCode: number;
    logicalLines: number;
    commentLines: number;
    commentRatio: number;
    maxNesting: number;
    functionCount: number;
    avgFunctionLength: number;
    duplicateLineRatio: number;
    magicNumbers: number;
  };
  issues: Array<{
    type: "error" | "warning" | "info";
    category: string;
    message: string;
    line?: number;
    suggestion?: string;
  }>;
  suggestions: string[];
  summary: string;
}

export interface KnowledgeResult {
  id: number;
  title: string;
  content: string;
  score: number;
}

export interface AIAdminStatus {
  mode: "local_model" | "built_in_rag";
  localModelEndpoint: string | null;
  localOnline: boolean;
  registry: { models: number };
  usage: { conversations: number; messages: number };
  version: string;
}

// ─── Query keys ────────────────────────────────────────────────────────────────

export const aiKeys = {
  conversations: () => ["ai-conversations"] as const,
  conversation: (id: number) => ["ai-conversation", id] as const,
  messages: (id: number) => ["ai-messages", id] as const,
  adminStatus: () => ["ai-admin-status"] as const,
  adminModels: () => ["ai-admin-models"] as const,
  adminPrompts: () => ["ai-admin-prompts"] as const,
  adminAnalytics: () => ["ai-admin-analytics"] as const,
  adminAudit: () => ["ai-admin-audit"] as const,
  knowledgeStats: () => ["ai-knowledge-stats"] as const,
  learningInsights: () => ["ai-learning-insights"] as const,
  learningProfile: () => ["ai-learning-profile"] as const,
  learningRecommendations: () => ["ai-learning-recommendations"] as const,
  studentAnalytics: (id: number) => ["ai-student-analytics", id] as const,
  cohortAnalytics: (id: number) => ["ai-cohort-analytics", id] as const,
  platformAnalytics: () => ["ai-platform-analytics"] as const,
  atRiskStudents: () => ["ai-at-risk-students"] as const,
  interviewSession: (id: number) => ["ai-interview-session", id] as const,
};

// ─── Conversation hooks ────────────────────────────────────────────────────────

export function useAIConversations() {
  return useQuery({
    queryKey: aiKeys.conversations(),
    queryFn: () => customFetch<AIConversation[]>("/api/ai/conversations"),
  });
}

export function useAIConversation(id: number) {
  return useQuery({
    queryKey: aiKeys.conversation(id),
    queryFn: () => customFetch<AIConversation & { messages: AIMessage[] }>(`/api/ai/conversations/${id}`),
    enabled: !!id,
  });
}

export function useCreateAIConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mode: AIMode; title?: string; courseId?: number; lessonId?: number; challengeId?: number; assignmentId?: number }) =>
      customFetch<AIConversation>("/api/ai/conversations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiKeys.conversations() }),
  });
}

export function useDeleteAIConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch(`/api/ai/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiKeys.conversations() }),
  });
}

// ─── Code analysis hooks ───────────────────────────────────────────────────────

export function useAnalyzeCode() {
  return useMutation({
    mutationFn: (data: { code: string; language?: string }) =>
      customFetch<CodeQualityReport>("/api/ai/code/analyze", { method: "POST", body: JSON.stringify(data) }),
  });
}

// ─── Knowledge search ──────────────────────────────────────────────────────────

export function useKnowledgeSearch() {
  return useMutation({
    mutationFn: (query: string) =>
      customFetch<KnowledgeResult[]>(`/api/ai/knowledge/search?q=${encodeURIComponent(query)}`),
  });
}

export function useKnowledgeStats() {
  return useQuery({
    queryKey: aiKeys.knowledgeStats(),
    queryFn: () => customFetch<{ totalChunks: number; bySource: Record<string, number> }>("/api/ai/knowledge/stats"),
  });
}

export function useSyncKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => customFetch<{ indexed: number; message: string }>("/api/ai/knowledge/sync", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiKeys.knowledgeStats() }),
  });
}

// ─── Learning insights ─────────────────────────────────────────────────────────

export function useLearningInsights() {
  return useQuery({
    queryKey: aiKeys.learningInsights(),
    queryFn: () => customFetch<{ insights: Array<{ type: string; topic: string; detail: string; priority: string }> }>("/api/ai/learning/insights"),
  });
}

// ─── Admin hooks ───────────────────────────────────────────────────────────────

export function useAIAdminStatus() {
  return useQuery({
    queryKey: aiKeys.adminStatus(),
    queryFn: () => customFetch<AIAdminStatus>("/api/ai/admin/status"),
    refetchInterval: 30000,
  });
}

export function useAIAdminAnalytics() {
  return useQuery({
    queryKey: aiKeys.adminAnalytics(),
    queryFn: () => customFetch<any>("/api/ai/admin/analytics"),
  });
}

export function useAIAdminModels() {
  return useQuery({
    queryKey: aiKeys.adminModels(),
    queryFn: () => customFetch<any[]>("/api/ai/admin/models"),
  });
}

export function useAIAdminPrompts() {
  return useQuery({
    queryKey: aiKeys.adminPrompts(),
    queryFn: () => customFetch<any[]>("/api/ai/admin/prompts"),
  });
}

export function useAIAdminAudit() {
  return useQuery({
    queryKey: aiKeys.adminAudit(),
    queryFn: () => customFetch<any[]>("/api/ai/admin/audit"),
  });
}

// ─── Learning Profile & Adaptive Learning hooks ────────────────────────────────

export interface LearningProfile {
  skillScores: Record<string, number>;
  weakTopics: string[];
  strongTopics: string[];
  learningVelocity: number;
  riskLevel: string;
  competencyScore: number;
  totalAIInteractions: number;
  preferredMode: string | null;
  recommendations: Array<{
    type: string;
    skillArea: string;
    detail: string;
    priority: "high" | "medium" | "low";
    actionItems: string[];
  }>;
}

export function useLearningProfile() {
  return useQuery({
    queryKey: aiKeys.learningProfile(),
    queryFn: () => customFetch<{ profile: LearningProfile; recentAssessments: any[] }>("/api/ai/learning/profile"),
  });
}

export function useRecordSkillAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { skillArea: string; score: number; source: string; sourceId?: number }) =>
      customFetch<{ updated: boolean; skillArea: string; newScore: number }>("/api/ai/learning/skill-assessment", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.learningProfile() });
      qc.invalidateQueries({ queryKey: aiKeys.learningRecommendations() });
    },
  });
}

export function useLearningRecommendations() {
  return useQuery({
    queryKey: aiKeys.learningRecommendations(),
    queryFn: () => customFetch<{ recommendations: LearningProfile["recommendations"] }>("/api/ai/learning/recommendations"),
  });
}

export function usePerformanceForecast(weeksRemaining = 8) {
  return useQuery({
    queryKey: ["ai-forecast", weeksRemaining],
    queryFn: () => customFetch<{
      predictedCompetencyScore: number;
      confidenceLevel: string;
      weeksToTargetScore: number | null;
      trend: "improving" | "stable" | "declining";
      onTrackForCompletion: boolean;
    }>(`/api/ai/learning/forecast?weeksRemaining=${weeksRemaining}`),
  });
}

// ─── Analytics hooks ───────────────────────────────────────────────────────────

export function useStudentAnalytics(userId: number) {
  return useQuery({
    queryKey: aiKeys.studentAnalytics(userId),
    queryFn: () => customFetch<any>(`/api/ai/analytics/student/${userId}`),
    enabled: !!userId,
  });
}

export function useCohortAnalytics(cohortId: number) {
  return useQuery({
    queryKey: aiKeys.cohortAnalytics(cohortId),
    queryFn: () => customFetch<any>(`/api/ai/analytics/cohort/${cohortId}`),
    enabled: !!cohortId,
  });
}

export function usePlatformAnalytics() {
  return useQuery({
    queryKey: aiKeys.platformAnalytics(),
    queryFn: () => customFetch<any>("/api/ai/analytics/platform"),
  });
}

export function useAtRiskStudents() {
  return useQuery({
    queryKey: aiKeys.atRiskStudents(),
    queryFn: () => customFetch<{ atRiskStudents: any[]; total: number }>("/api/ai/learning/at-risk"),
  });
}

// ─── Interview Session hooks ───────────────────────────────────────────────────

export function useStartInterviewSession() {
  return useMutation({
    mutationFn: (data: {
      sessionType?: "technical" | "behavioral" | "coding" | "mixed";
      topic?: string;
      difficulty?: "easy" | "medium" | "hard";
      questionCount?: number;
    }) => customFetch<{ sessionId: number; questionNumber: number; total: number; question: string; keyPoints: string[] }>(
      "/api/ai/interview/session/start", { method: "POST", body: JSON.stringify(data) }
    ),
  });
}

export function useSubmitSessionAnswer() {
  return useMutation({
    mutationFn: ({ sessionId, answer }: { sessionId: number; answer: string }) =>
      customFetch<any>(`/api/ai/interview/session/${sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      }),
  });
}

export function useInterviewSessionReport(sessionId: number) {
  return useQuery({
    queryKey: aiKeys.interviewSession(sessionId),
    queryFn: () => customFetch<any>(`/api/ai/interview/session/${sessionId}/report`),
    enabled: !!sessionId,
  });
}

// ─── Feedback hook ─────────────────────────────────────────────────────────────

export function useAIFeedback() {
  return useMutation({
    mutationFn: (data: { messageId: number; rating: number; helpful?: boolean; comment?: string }) =>
      customFetch(`/api/ai/messages/${data.messageId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating: data.rating, helpful: data.helpful, comment: data.comment }),
      }),
  });
}

// ─── SSE streaming helper ──────────────────────────────────────────────────────

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (messageId?: number) => void;
  onError: (err: string) => void;
}

export async function streamAIMessage(
  conversationId: number,
  content: string,
  context: Record<string, unknown>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, context }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "AI request failed" }));
    callbacks.onError(data.error ?? "AI request failed");
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) { callbacks.onError(data.error); return; }
        if (data.done) { callbacks.onDone(data.messageId); return; }
        if (data.content) callbacks.onChunk(data.content);
      } catch { /* skip */ }
    }
  }
}

export async function streamAITool(
  endpoint: string,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "AI request failed" }));
    callbacks.onError(data.error ?? "AI request failed");
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) { callbacks.onError(data.error); return; }
        if (data.done) { callbacks.onDone(); return; }
        if (data.content) callbacks.onChunk(data.content);
      } catch { /* skip */ }
    }
  }
}
