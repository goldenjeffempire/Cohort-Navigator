/**
 * Phase 3 — Coding Workspace & Assessment API hooks.
 * Written directly (not orval-generated) to avoid regenerating the full
 * openapi.yaml. Uses the same customFetch infrastructure as the rest of
 * the generated client.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CodingLanguage =
  | "javascript" | "typescript" | "python" | "bash" | "html" | "css" | "sql";

export type ChallengeDifficulty = "easy" | "medium" | "hard";
export type ChallengeType = "practice" | "assessment" | "capstone" | "weekly";
export type ChallengeSubmissionStatus =
  | "pending" | "running" | "passed" | "partial" | "failed" | "error" | "timeout";

export interface CodingChallenge {
  id: number;
  title: string;
  description: string;
  instructions?: string | null;
  difficulty: ChallengeDifficulty;
  type: ChallengeType;
  language: CodingLanguage;
  starterCode?: string | null;
  solutionCode?: string | null;
  courseId?: number | null;
  moduleId?: number | null;
  maxAttempts?: number | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  isPublished: boolean;
  points: number;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
  myAttempts?: number;
  mySolved?: boolean;
  testCases?: ChallengeTestCase[];
  totalTestCases?: number;
}

export interface ChallengeTestCase {
  id: number;
  challengeId: number;
  description?: string | null;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  order: number;
}

export interface ChallengeSubmission {
  id: number;
  challengeId: number;
  studentId: number;
  code: string;
  language: CodingLanguage;
  status: ChallengeSubmissionStatus;
  score: number;
  maxScore: number;
  passedTests: number;
  totalTests: number;
  executionTimeMs?: number | null;
  feedback?: string | null;
  attemptNumber: number;
  overrideScore?: number | null;
  overrideFeedback?: string | null;
  submittedAt: string;
  studentName?: string;
  studentEmail?: string;
  challengeTitle?: string;
}

export interface SubmissionTestResult {
  id: number;
  testCaseId: number;
  passed: boolean;
  actualOutput?: string | null;
  executionTimeMs?: number | null;
  errorMessage?: string | null;
  description?: string | null;
  isHidden: boolean;
  input?: string;
  expectedOutput?: string;
}

export interface SubmissionDetail extends ChallengeSubmission {
  testResults: SubmissionTestResult[];
}

export interface SubmitResult {
  submission: ChallengeSubmission;
  testResults: SubmissionTestResult[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
}

export interface CodingProgress {
  totalSubmissions: number;
  passedSubmissions: number;
  totalPoints: number;
  solvedChallenges: number;
  totalExecutions: number;
  languageBreakdown: Record<string, number>;
  recentSubmissions: Array<{
    id: number;
    challengeId: number;
    status: ChallengeSubmissionStatus;
    score: number;
    submittedAt: string;
    challengeTitle?: string;
  }>;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
    totalChallengesSolved: number;
  };
}

export interface PlagiarismReport {
  id: number;
  challengeId: number;
  submission1Id: number;
  submission2Id: number;
  similarityScore: number;
  flagged: boolean;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  createdAt: string;
  student1Name?: string;
  student2Name?: string;
}

export interface SupportedLanguage {
  id: string;
  label: string;
  monacoId: string;
  available: boolean;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const codingQueryKeys = {
  challenges: (params?: object) => ["challenges", params] as const,
  challenge: (id: number) => ["challenge", id] as const,
  challengeTestCases: (id: number) => ["challenge-test-cases", id] as const,
  challengeSubmissions: (id: number) => ["challenge-submissions", id] as const,
  allSubmissions: (params?: object) => ["all-submissions", params] as const,
  submission: (id: number) => ["submission", id] as const,
  codingProgress: () => ["coding-progress"] as const,
  codingStreak: () => ["coding-streak"] as const,
  leaderboard: () => ["coding-leaderboard"] as const,
  plagiarism: (challengeId: number) => ["plagiarism", challengeId] as const,
  languages: () => ["coding-languages"] as const,
};

// ─── Challenges ───────────────────────────────────────────────────────────────

export interface ListChallengesParams {
  courseId?: number;
  difficulty?: ChallengeDifficulty;
  language?: CodingLanguage;
  type?: ChallengeType;
  all?: boolean; // staff: include unpublished
}

export function useListChallenges(params?: ListChallengesParams) {
  return useQuery({
    queryKey: codingQueryKeys.challenges(params),
    queryFn: () => {
      const q = new URLSearchParams();
      if (params?.courseId) q.set("courseId", String(params.courseId));
      if (params?.difficulty) q.set("difficulty", params.difficulty);
      if (params?.language) q.set("language", params.language);
      if (params?.type) q.set("type", params.type);
      if (params?.all) q.set("all", "1");
      const qs = q.toString();
      return customFetch<CodingChallenge[]>(`/api/challenges${qs ? "?" + qs : ""}`);
    },
  });
}

export function useGetChallenge(id: number) {
  return useQuery({
    queryKey: codingQueryKeys.challenge(id),
    queryFn: () => customFetch<CodingChallenge>(`/api/challenges/${id}`),
    enabled: !!id,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CodingChallenge>) =>
      customFetch<CodingChallenge>("/api/challenges", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}

export function useUpdateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CodingChallenge> }) =>
      customFetch<CodingChallenge>(`/api/challenges/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: codingQueryKeys.challenge(id) });
    },
  });
}

export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/challenges/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}

// ─── Test cases ───────────────────────────────────────────────────────────────

export function useListChallengeTestCases(challengeId: number) {
  return useQuery({
    queryKey: codingQueryKeys.challengeTestCases(challengeId),
    queryFn: () =>
      customFetch<ChallengeTestCase[]>(`/api/challenges/${challengeId}/test-cases`),
    enabled: !!challengeId,
  });
}

export function useAddTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      challengeId,
      data,
    }: {
      challengeId: number;
      data: Partial<ChallengeTestCase>;
    }) =>
      customFetch<ChallengeTestCase>(`/api/challenges/${challengeId}/test-cases`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_r, { challengeId }) => {
      qc.invalidateQueries({ queryKey: codingQueryKeys.challengeTestCases(challengeId) });
      qc.invalidateQueries({ queryKey: codingQueryKeys.challenge(challengeId) });
    },
  });
}

export function useDeleteTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, challengeId }: { id: number; challengeId: number }) =>
      customFetch(`/api/test-cases/${id}`, { method: "DELETE" }),
    onSuccess: (_r, { challengeId }) => {
      qc.invalidateQueries({ queryKey: codingQueryKeys.challengeTestCases(challengeId) });
    },
  });
}

// ─── Code execution ───────────────────────────────────────────────────────────

export function useExecuteCode() {
  return useMutation({
    mutationFn: (data: {
      code: string;
      language: CodingLanguage;
      stdin?: string;
      challengeId?: number;
    }) =>
      customFetch<ExecutionResult>("/api/execute", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

// ─── Submission ───────────────────────────────────────────────────────────────

export function useSubmitChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      challengeId,
      code,
      language,
    }: {
      challengeId: number;
      code: string;
      language: CodingLanguage;
    }) =>
      customFetch<SubmitResult>(`/api/challenges/${challengeId}/submit`, {
        method: "POST",
        body: JSON.stringify({ code, language }),
      }),
    onSuccess: (_r, { challengeId }) => {
      qc.invalidateQueries({ queryKey: codingQueryKeys.challengeSubmissions(challengeId) });
      qc.invalidateQueries({ queryKey: codingQueryKeys.codingProgress() });
      qc.invalidateQueries({ queryKey: codingQueryKeys.codingStreak() });
    },
  });
}

export function useListChallengeSubmissions(challengeId: number) {
  return useQuery({
    queryKey: codingQueryKeys.challengeSubmissions(challengeId),
    queryFn: () =>
      customFetch<ChallengeSubmission[]>(`/api/challenges/${challengeId}/submissions`),
    enabled: !!challengeId,
  });
}

export function useListAllSubmissions(params?: { challengeId?: number; studentId?: number }) {
  return useQuery({
    queryKey: codingQueryKeys.allSubmissions(params),
    queryFn: () => {
      const q = new URLSearchParams();
      if (params?.challengeId) q.set("challengeId", String(params.challengeId));
      if (params?.studentId) q.set("studentId", String(params.studentId));
      const qs = q.toString();
      return customFetch<ChallengeSubmission[]>(`/api/submissions${qs ? "?" + qs : ""}`);
    },
  });
}

export function useGetSubmission(id: number) {
  return useQuery({
    queryKey: codingQueryKeys.submission(id),
    queryFn: () => customFetch<SubmissionDetail>(`/api/submissions/${id}`),
    enabled: !!id,
  });
}

export function useGradeOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      overrideScore,
      overrideFeedback,
    }: {
      id: number;
      overrideScore: number;
      overrideFeedback?: string;
    }) =>
      customFetch<ChallengeSubmission>(`/api/submissions/${id}/grade`, {
        method: "PATCH",
        body: JSON.stringify({ overrideScore, overrideFeedback }),
      }),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: codingQueryKeys.submission(id) });
      qc.invalidateQueries({ queryKey: ["all-submissions"] });
    },
  });
}

// ─── Progress & Analytics ────────────────────────────────────────────────────

export function useGetCodingProgress() {
  return useQuery({
    queryKey: codingQueryKeys.codingProgress(),
    queryFn: () => customFetch<CodingProgress>("/api/coding/progress"),
  });
}

export function useGetCodingStreak() {
  return useQuery({
    queryKey: codingQueryKeys.codingStreak(),
    queryFn: () => customFetch<{ currentStreak: number; longestStreak: number; lastActivityDate: string | null; totalChallengesSolved: number }>("/api/coding/streak"),
  });
}

export function useGetLeaderboard() {
  return useQuery({
    queryKey: codingQueryKeys.leaderboard(),
    queryFn: () =>
      customFetch<Array<{ rank: number; userId: number; name: string; totalPoints: number; solvedCount: number }>>(
        "/api/coding/leaderboard",
      ),
  });
}

export function useGetSupportedLanguages() {
  return useQuery({
    queryKey: codingQueryKeys.languages(),
    queryFn: () => customFetch<SupportedLanguage[]>("/api/coding/languages"),
    staleTime: Infinity,
  });
}

// ─── Plagiarism ───────────────────────────────────────────────────────────────

export function useGetPlagiarismReports(challengeId: number) {
  return useQuery({
    queryKey: codingQueryKeys.plagiarism(challengeId),
    queryFn: () =>
      customFetch<PlagiarismReport[]>(`/api/plagiarism/${challengeId}`),
    enabled: !!challengeId,
  });
}

export function useRunPlagiarismCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: number) =>
      customFetch<{ message: string; reports: PlagiarismReport[] }>(
        `/api/plagiarism/${challengeId}/run`,
        { method: "POST" },
      ),
    onSuccess: (_r, challengeId) => {
      qc.invalidateQueries({ queryKey: codingQueryKeys.plagiarism(challengeId) });
    },
  });
}

export function useReviewPlagiarismReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      challengeId,
      flagged,
    }: {
      id: number;
      challengeId: number;
      flagged: boolean;
    }) =>
      customFetch<PlagiarismReport>(`/api/plagiarism/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ flagged }),
      }),
    onSuccess: (_r, { challengeId }) => {
      qc.invalidateQueries({ queryKey: codingQueryKeys.plagiarism(challengeId) });
    },
  });
}
