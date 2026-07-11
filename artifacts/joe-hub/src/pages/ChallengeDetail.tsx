import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  useGetChallenge,
  useExecuteCode,
  useSubmitChallenge,
  useListChallengeSubmissions,
  type ChallengeSubmissionStatus,
  type ExecutionResult,
  type SubmitResult,
} from "@/lib/coding";
import CodeEditor, { type EditorTheme } from "@/components/editor/CodeEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, Play, Send, Sun, Moon, Clock, Trophy,
  CheckCircle2, XCircle, AlertTriangle, Terminal, History,
  FileQuestion, Eye, EyeOff,
} from "lucide-react";
import { format } from "date-fns";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  hard: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_DISPLAY: Record<ChallengeSubmissionStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-gray-500" },
  running: { label: "Running…", color: "text-blue-600" },
  passed: { label: "Passed ✓", color: "text-green-600" },
  partial: { label: "Partial", color: "text-yellow-600" },
  failed: { label: "Failed", color: "text-red-600" },
  error: { label: "Error", color: "text-red-600" },
  timeout: { label: "Timeout", color: "text-orange-600" },
};

const STORAGE_KEY = (id: number) => `joe-challenge-code-${id}`;

function StatusBadge({ status }: { status: ChallengeSubmissionStatus }) {
  const { label, color } = STATUS_DISPLAY[status] ?? { label: status, color: "text-gray-500" };
  return <span className={`font-medium text-sm ${color}`}>{label}</span>;
}

// ─── Output panel ─────────────────────────────────────────────────────────────

function OutputPanel({
  execResult,
  submitResult,
  isRunning,
  isSubmitting,
}: {
  execResult: ExecutionResult | null;
  submitResult: SubmitResult | null;
  isRunning: boolean;
  isSubmitting: boolean;
}) {
  if (isRunning || isSubmitting) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-gray-500 bg-gray-950 text-gray-300 font-mono">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        {isRunning ? "Running your code…" : "Submitting and grading…"}
      </div>
    );
  }

  if (submitResult) {
    const { submission, testResults } = submitResult;
    const statusInfo = STATUS_DISPLAY[submission.status];
    return (
      <div className="bg-gray-950 text-gray-100 font-mono text-sm overflow-y-auto max-h-64">
        <div className={`px-4 py-2 border-b border-gray-800 flex items-center justify-between ${
          submission.status === "passed" ? "bg-green-900/40" : submission.status === "partial" ? "bg-yellow-900/30" : "bg-red-900/30"
        }`}>
          <span className={statusInfo.color.replace("text-", "text-") + " font-semibold"}>
            {statusInfo.label} — {submission.passedTests}/{submission.totalTests} tests
          </span>
          <span className="text-gray-400 text-xs">{submission.score}/{submission.maxScore} pts · {submission.executionTimeMs}ms</span>
        </div>
        {submission.feedback && (
          <div className="px-4 py-2 text-gray-400 text-xs border-b border-gray-800">{submission.feedback}</div>
        )}
        <div className="divide-y divide-gray-800">
          {testResults.map((r, i) => (
            <div key={r.id} className="px-4 py-2 flex items-start gap-3">
              {r.passed
                ? <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-0.5">
                  {r.isHidden ? "Hidden Test Case" : r.description || `Test ${i + 1}`}
                </div>
                {!r.isHidden && r.actualOutput !== null && r.actualOutput !== undefined && (
                  <div className="text-xs space-y-0.5">
                    {!r.passed && r.expectedOutput && (
                      <div><span className="text-gray-500">Expected: </span><span className="text-green-400">{r.expectedOutput}</span></div>
                    )}
                    <div><span className="text-gray-500">Got: </span><span className={r.passed ? "text-green-400" : "text-red-400"}>{r.actualOutput || "(empty)"}</span></div>
                  </div>
                )}
                {r.errorMessage && !r.isHidden && (
                  <div className="text-red-400 text-xs mt-0.5">{r.errorMessage}</div>
                )}
              </div>
              {r.executionTimeMs !== null && r.executionTimeMs !== undefined && (
                <span className="text-gray-500 text-xs shrink-0">{r.executionTimeMs}ms</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (execResult) {
    const hasOutput = execResult.stdout || execResult.stderr;
    return (
      <div className="bg-gray-950 text-gray-100 font-mono text-sm overflow-y-auto max-h-64">
        <div className="px-4 py-1.5 border-b border-gray-800 flex items-center gap-2 text-xs text-gray-400">
          <Terminal className="h-3.5 w-3.5" />
          <span>Output</span>
          {execResult.timedOut && <span className="text-orange-400 ml-auto">Timed out</span>}
          {!execResult.timedOut && <span className="ml-auto">{execResult.executionTimeMs}ms</span>}
        </div>
        {hasOutput ? (
          <pre className="p-4 whitespace-pre-wrap break-words leading-relaxed text-xs">
            {execResult.stdout && <span className="text-gray-100">{execResult.stdout}</span>}
            {execResult.stderr && <span className="text-red-400">{execResult.stderr}</span>}
          </pre>
        ) : (
          <div className="p-4 text-gray-500 text-xs">(no output)</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-gray-500 font-mono text-xs p-4">
      Press <kbd className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">▶ Run</kbd> to test your code,
      or <kbd className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">Submit</kbd> for grading.
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChallengeDetail() {
  const params = useParams();
  const challengeId = Number(params.id);
  const { data: me } = useGetMe();
  const { toast } = useToast();

  const { data: challenge, isLoading } = useGetChallenge(challengeId);
  const { data: submissions, refetch: refetchSubmissions } = useListChallengeSubmissions(challengeId);

  const executeMutation = useExecuteCode();
  const submitMutation = useSubmitChallenge();

  const [code, setCode] = useState<string>("");
  const [theme, setTheme] = useState<EditorTheme>("dark");
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  // Initialize code from localStorage or starter code
  useEffect(() => {
    if (!challenge) return;
    const saved = localStorage.getItem(STORAGE_KEY(challengeId));
    setCode(saved ?? challenge.starterCode ?? "");
  }, [challenge, challengeId]);

  // Auto-save code to localStorage
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleCodeChange = useCallback((val: string) => {
    setCode(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY(challengeId), val);
    }, 1000);
  }, [challengeId]);

  const handleRun = () => {
    if (!challenge) return;
    setSubmitResult(null);
    setExecResult(null);
    executeMutation.mutate(
      { code, language: challenge.language, challengeId },
      {
        onSuccess: (result) => setExecResult(result),
        onError: (err) => toast({ title: "Execution failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleSubmit = () => {
    if (!challenge) return;
    setExecResult(null);
    setSubmitResult(null);
    submitMutation.mutate(
      { challengeId, code, language: challenge.language },
      {
        onSuccess: (result) => {
          setSubmitResult(result);
          refetchSubmissions();
          const { status } = result.submission;
          if (status === "passed") toast({ title: "🎉 All tests passed!", description: `Score: ${result.submission.score}/${result.submission.maxScore}` });
          else if (status === "partial") toast({ title: "Partial pass", description: result.submission.feedback ?? "" });
          else toast({ title: "Tests failed", description: result.submission.feedback ?? "", variant: "destructive" });
        },
        onError: (err) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 gap-4 h-[600px]">
          <Skeleton className="h-full rounded-xl" />
          <Skeleton className="h-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!challenge) return <div className="p-8 text-center text-gray-500">Challenge not found.</div>;

  const isStaff = me?.role === "admin" || me?.role === "mentor";
  const myBestSubmission = submissions
    ?.filter((s) => s.status === "passed")
    .sort((a, b) => b.score - a.score)[0];

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[45%_55%] h-[calc(100vh-64px)] overflow-hidden">

      {/* ── Left panel: Problem ──────────────────────────────────────── */}
      <div className="flex flex-col border-r border-gray-200 overflow-hidden">
        {/* Back + title */}
        <div className="p-4 border-b border-gray-100 bg-white shrink-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-gray-500">
            <Link href="/challenges">
              <ChevronLeft className="mr-1 h-4 w-4" /> Challenges
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className={`capitalize text-xs ${DIFFICULTY_COLORS[challenge.difficulty]}`}>
                  {challenge.difficulty}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize bg-gray-100">
                  {challenge.language}
                </Badge>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-amber-500" /> {challenge.points} pts
                </span>
              </div>
              <h1 className="text-lg font-display font-bold text-gray-900 leading-tight">
                {challenge.title}
              </h1>
            </div>
            {myBestSubmission && (
              <div className="shrink-0 flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 rounded-lg px-2 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Solved
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="problem" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="shrink-0 rounded-none border-b bg-white h-10 px-4 justify-start gap-1 p-0">
            <TabsTrigger value="problem" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 text-sm">Problem</TabsTrigger>
            <TabsTrigger value="testcases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 text-sm">
              Test Cases
              <span className="ml-1 text-xs text-gray-400">({challenge.testCases?.length ?? 0})</span>
            </TabsTrigger>
            <TabsTrigger value="submissions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 text-sm">
              My Submissions
              {submissions && submissions.length > 0 && (
                <span className="ml-1 text-xs text-gray-400">({submissions.length})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="problem" className="flex-1 overflow-y-auto m-0 p-6">
            <div className="prose prose-sm prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{challenge.description}</p>
              {challenge.instructions && (
                <>
                  <h3 className="text-base font-semibold mt-6 mb-3">Instructions</h3>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-line">{challenge.instructions}</div>
                </>
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">Time Limit</div>
                <div className="font-medium text-gray-800 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  {challenge.timeLimitMs / 1000}s per test
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">Max Attempts</div>
                <div className="font-medium text-gray-800">
                  {challenge.maxAttempts ? `${submissions?.length ?? 0} / ${challenge.maxAttempts}` : "Unlimited"}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="testcases" className="flex-1 overflow-y-auto m-0 p-0">
            <div className="divide-y divide-gray-100">
              {challenge.testCases?.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">No public test cases.</div>
              )}
              {challenge.testCases?.map((tc, i) => (
                <div key={tc.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileQuestion className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      {tc.description || `Test Case ${i + 1}`}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">{tc.points} pts</span>
                  </div>
                  {tc.input && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-400 mb-1">Input</div>
                      <pre className="bg-gray-50 border border-gray-100 rounded p-2 text-xs font-mono text-gray-800 whitespace-pre-wrap">{tc.input}</pre>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Expected Output</div>
                    <pre className="bg-green-50 border border-green-100 rounded p-2 text-xs font-mono text-green-800 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                  </div>
                </div>
              ))}
              {challenge.totalTestCases && challenge.testCases && challenge.totalTestCases > challenge.testCases.length && (
                <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 flex items-center justify-center gap-1">
                  <EyeOff className="h-3.5 w-3.5" />
                  +{challenge.totalTestCases - challenge.testCases.length} hidden test cases (used for grading)
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="flex-1 overflow-y-auto m-0 p-0">
            {!submissions || submissions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No submissions yet. Write your solution and submit!</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {submissions.map((sub) => (
                  <div key={sub.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <StatusBadge status={sub.status} />
                      <div className="text-xs text-gray-400 mt-0.5">
                        Attempt #{sub.attemptNumber} · {format(new Date(sub.submittedAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {sub.overrideScore ?? sub.score} / {sub.maxScore}
                      </div>
                      <div className="text-xs text-gray-400">
                        {sub.passedTests}/{sub.totalTests} tests
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Right panel: Editor ──────────────────────────────────────── */}
      <div className="flex flex-col bg-gray-950 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
            <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
            <span className="text-gray-400 ml-2 font-mono text-xs">solution.{challenge.language}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-300 hover:text-white hover:bg-gray-700 h-7 text-xs"
              onClick={() => {
                if (challenge.starterCode) {
                  setCode(challenge.starterCode);
                  localStorage.removeItem(STORAGE_KEY(challengeId));
                }
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Monaco editor */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            language={challenge.language}
            theme={theme}
            height="100%"
          />
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 bg-gray-900 border-y border-gray-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500">
            {submissions?.length ? `${submissions.length} submission${submissions.length !== 1 ? "s" : ""}` : "No submissions yet"}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 hover:text-white"
              onClick={handleRun}
              disabled={executeMutation.isPending}
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {executeMutation.isPending ? "Running…" : "Run Code"}
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={submitMutation.isPending || (!!challenge.maxAttempts && (submissions?.length ?? 0) >= challenge.maxAttempts)}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {submitMutation.isPending ? "Grading…" : "Submit"}
            </Button>
          </div>
        </div>

        {/* Output panel */}
        <OutputPanel
          execResult={execResult}
          submitResult={submitResult}
          isRunning={executeMutation.isPending}
          isSubmitting={submitMutation.isPending}
        />
      </div>
    </div>
  );
}
