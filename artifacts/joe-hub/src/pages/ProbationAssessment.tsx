import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Clock, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Send } from "lucide-react";

type Question = {
  id: number;
  question: string;
  options: { id: string; text: string }[];
  points: number;
  order_index: number;
};

type AssessmentResult = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  status: string;
  feedback: string;
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ProbationAssessment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();

  // Fetch the user's active application
  const { data: apps } = useQuery({
    queryKey: ["/api/scholarship-applications/me"],
    queryFn: () => customFetch<any[]>("/api/scholarship-applications/me"),
  });

  const app = apps?.find((a: any) => a.status === "probation_assessment");

  // Assessment data (questions + attempt state)
  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ["/api/scholarship-applications", app?.id, "assessment"],
    queryFn: () => customFetch<any>(`/api/scholarship-applications/${app!.id}/assessment`),
    enabled: !!app?.id,
  });

  const questions: Question[] = assessmentData?.questions ?? [];
  const existingAttempt = assessmentData?.attempt;
  const timeLimitMinutes: number = assessmentData?.timeLimitMinutes ?? 60;

  // Start attempt mutation
  const startMutation = useMutation({
    mutationFn: () => customFetch<any>(`/api/scholarship-applications/${app!.id}/assessment/start`, { method: "POST" }),
    onSuccess: (attempt) => {
      setAttemptId(attempt.id);
      const elapsed = attempt.started_at ? Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000) : 0;
      setSecondsLeft(Math.max(0, timeLimitMinutes * 60 - elapsed));
      setStarted(true);
    },
    onError: (err: any) => {
      // Already started — use existing
      if (err.status === 409 && err.data?.attempt) {
        const attempt = err.data.attempt;
        if (attempt.is_completed) { setResult(attempt as any); return; }
        setAttemptId(attempt.id);
        const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
        setSecondsLeft(Math.max(0, timeLimitMinutes * 60 - elapsed));
        setStarted(true);
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: { answers: Record<string, string>; isAutoSubmitted: boolean }) =>
      customFetch<AssessmentResult>(`/api/scholarship-applications/${app!.id}/assessment/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/scholarship-applications/me"] });
      qc.invalidateQueries({ queryKey: ["/api/users/me"] });
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes * 60);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const autoSubmittedRef = useRef(false);

  // Resume if attempt already in progress
  useEffect(() => {
    if (existingAttempt && !existingAttempt.is_completed && !started) {
      setAttemptId(existingAttempt.id);
      const elapsed = Math.floor((Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000);
      const remaining = Math.max(0, timeLimitMinutes * 60 - elapsed);
      setSecondsLeft(remaining);
      if (existing?.answers) setAnswers(existingAttempt.answers ?? {});
      setStarted(true);
    } else if (existingAttempt?.is_completed) {
      setResult(existingAttempt as any);
    }
  }, [existingAttempt, timeLimitMinutes, started]);

  // Timer
  useEffect(() => {
    if (!started || result) return;
    if (secondsLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submitMutation.mutate({ answers, isAutoSubmitted: true });
      }
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(interval);
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            submitMutation.mutate({ answers, isAutoSubmitted: true });
          }
          return 0;
        }
        if (s === 300) setShowTimeoutWarning(true); // 5 min warning
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [started, result, secondsLeft]);

  const timerColor = secondsLeft < 300 ? "text-red-600" : secondsLeft < 600 ? "text-amber-600" : "text-gray-700";
  const answered = Object.keys(answers).length;
  const progress = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;

  if (!app && !isLoading) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <AlertTriangle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">Assessment Not Available</h2>
        <p className="text-gray-500 mb-6">The probation assessment is only available when your application status is "Probation Assessment".</p>
        <Button onClick={() => setLocation("/scholarship/status")}>View Application Status</Button>
      </div>
    );
  }

  // ── Result screen ──────────────────────────────────────────────────────────
  if (result) {
    const passed = (result as any).passed ?? (result as any).score >= 70;
    const score = (result as any).score ?? (result as any).assessment_score;
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className={`border-2 ${passed ? "border-green-300" : "border-red-300"} shadow-lg`}>
          <CardContent className="p-10 text-center">
            {passed ? (
              <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
            ) : (
              <XCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />
            )}
            <h2 className={`text-3xl font-display font-bold mb-2 ${passed ? "text-green-700" : "text-red-700"}`}>
              {passed ? "Congratulations — You Passed!" : "Assessment Complete"}
            </h2>
            <div className={`text-6xl font-bold font-display my-6 ${passed ? "text-green-600" : "text-red-600"}`}>
              {score}%
            </div>
            <p className={`text-lg mb-2 ${passed ? "text-green-700" : "text-red-600"}`}>
              {passed ? "You have been fully admitted to JOE Forge!" : "You did not reach the 70% passing score."}
            </p>
            {(result as any).correct !== undefined && (
              <p className="text-gray-500 text-sm mb-6">
                {(result as any).correct} / {(result as any).total} questions correct
              </p>
            )}
            <div className={`text-sm rounded-xl p-4 mb-8 ${passed ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {(result as any).feedback ?? (result as any).review_notes}
            </div>
            <Button onClick={() => { qc.invalidateQueries(); setLocation("/dashboard"); }} size="lg" className="w-full">
              {passed ? "Go to Dashboard" : "View Application Status"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Pre-start screen ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="border-b border-gray-100 px-8 py-6 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-6 w-6 text-indigo-600" />
              <Badge className="bg-indigo-600 text-white">Probation Assessment</Badge>
            </div>
            <CardTitle className="text-2xl font-display">Admission Assessment</CardTitle>
            <CardDescription>Read all instructions carefully before starting.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <InfoBox label="Questions" value={String(questions.length || "—")} />
              <InfoBox label="Time Limit" value={`${timeLimitMinutes} min`} />
              <InfoBox label="Pass Score" value="70%" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
              <p className="font-semibold text-amber-800">Before you begin:</p>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>You have <strong>{timeLimitMinutes} minutes</strong> — the timer starts immediately.</li>
                <li>The assessment will auto-submit when time expires.</li>
                <li>You cannot restart once you begin.</li>
                <li>A score of <strong>70% or higher</strong> is required for full admission.</li>
                <li>Ensure you have a stable internet connection.</li>
              </ul>
            </div>
            <Button
              size="lg"
              className="w-full h-14 text-lg"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || questions.length === 0}
            >
              {startMutation.isPending ? "Starting…" : questions.length === 0 ? "No questions available" : "Begin Assessment"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Active assessment ───────────────────────────────────────────────────────
  const q = questions[currentQ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Question</p>
          <p className="font-bold text-gray-900">{currentQ + 1} / {questions.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Progress</p>
          <div className="flex items-center gap-2">
            <Progress value={progress} className="w-32 h-2" />
            <span className="text-xs text-gray-500">{answered}/{questions.length}</span>
          </div>
        </div>
        <div className={`text-right font-mono font-bold text-2xl ${timerColor}`}>
          <p className="text-xs font-sans font-normal text-gray-400 uppercase tracking-wide mb-0.5">Time Left</p>
          {formatTime(secondsLeft)}
        </div>
      </div>

      {/* Question card */}
      {q && (
        <Card className="shadow-md border-gray-200 mb-4">
          <CardContent className="p-8">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Question {currentQ + 1} · {q.points} point{q.points > 1 ? "s" : ""}</p>
            <p className="text-lg font-semibold text-gray-900 mb-6 leading-relaxed">{q.question}</p>
            <div className="space-y-3">
              {q.options.map(opt => {
                const selected = answers[String(q.id)] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setAnswers(a => ({ ...a, [String(q.id)]: opt.id }))}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                      selected
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 mr-3 text-xs font-bold flex-shrink-0 ${selected ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-400"}`}>
                      {opt.id.toUpperCase()}
                    </span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        {/* Question dots */}
        <div className="flex gap-1.5 flex-wrap justify-center max-w-sm">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-6 h-6 rounded-full text-xs font-medium transition-colors ${
                i === currentQ ? "bg-primary text-white" :
                answers[String(questions[i].id)] ? "bg-primary/20 text-primary border border-primary/30" :
                "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentQ < questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowConfirm(true)}
            disabled={submitMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" /> Submit
          </Button>
        )}
      </div>

      {/* Submit confirm */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered <strong>{answered}</strong> of <strong>{questions.length}</strong> questions.
              {answered < questions.length && <span className="text-amber-600"> {questions.length - answered} question(s) are unanswered.</span>}
              {" "}This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue reviewing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => submitMutation.mutate({ answers, isAutoSubmitted: false })}
            >
              {submitMutation.isPending ? "Submitting…" : "Yes, Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 5-min warning */}
      <AlertDialog open={showTimeoutWarning} onOpenChange={setShowTimeoutWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-700">⏰ 5 Minutes Remaining</AlertDialogTitle>
            <AlertDialogDescription>
              You have 5 minutes left. The assessment will auto-submit when time expires. Make sure to answer any remaining questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowTimeoutWarning(false)}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
      <p className="text-2xl font-bold font-display text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
