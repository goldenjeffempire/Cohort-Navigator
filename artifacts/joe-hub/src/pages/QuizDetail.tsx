import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetQuiz, useStartQuizAttempt, useListMyQuizAttempts, useGetAttempt,
  useListQuizQuestions, useSubmitAnswer, useSubmitQuizAttempt, useGetMe,
  useCreateQuestion, useDeleteQuestion, useUpdateQuiz, useDeleteQuiz,
  getGetAttemptQueryKey, getListQuizQuestionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Clock, FileQuestion, CheckCircle, PlayCircle,
  Plus, Trash2, PencilLine, CheckCircle2, Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ─── Student Quiz Taker ───────────────────────────────────────────────────────

function StudentQuizTaker({ quizId, quiz }: { quizId: number; quiz: any }) {
  const { data: attempts, refetch: refetchAttempts } = useListMyQuizAttempts(quizId);
  const startMutation = useStartQuizAttempt();
  const submitAnswerMutation = useSubmitAnswer();
  const finishMutation = useSubmitQuizAttempt();
  const { toast } = useToast();

  const activeAttempt = attempts?.find(a => a.status === 'in_progress');
  const completedAttempts = attempts?.filter(a => a.status === 'completed');
  const bestAttempt = completedAttempts?.sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const { data: activeAttemptDetails, refetch: refetchDetails } = useGetAttempt(
    activeAttempt?.id || 0,
    { query: { enabled: !!activeAttempt, queryKey: getGetAttemptQueryKey(activeAttempt?.id || 0) } }
  );
  const { data: questions } = useListQuizQuestions(
    quizId,
    { query: { enabled: !!activeAttempt, queryKey: getListQuizQuestionsQueryKey(quizId) } }
  );

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const startQuiz = () => {
    startMutation.mutate({ id: quizId }, {
      onSuccess: () => refetchAttempts(),
      onError: (err) => toast({ title: "Cannot start quiz", description: err.message, variant: "destructive" }),
    });
  };

  const submitAnswer = (optionId: number) => {
    if (!activeAttempt || !questions) return;
    const q = questions[currentQuestionIndex];
    submitAnswerMutation.mutate({
      id: activeAttempt.id,
      data: { questionId: q.id, selectedOptionId: optionId }
    }, {
      onSuccess: () => {
        refetchDetails();
        if (currentQuestionIndex < questions.length - 1) {
          setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 300);
        }
      }
    });
  };

  const finishQuiz = () => {
    if (!activeAttempt) return;
    finishMutation.mutate({ id: activeAttempt.id }, {
      onSuccess: () => {
        toast({ title: "Quiz Completed!", description: "Your score has been recorded." });
        refetchAttempts();
        setCurrentQuestionIndex(0);
      }
    });
  };

  if (activeAttempt && questions && activeAttemptDetails) {
    const q = questions[currentQuestionIndex];
    if (!q) return <Skeleton className="h-64 w-full" />;

    const existingAnswer = activeAttemptDetails.answers?.find(a => a.questionId === q.id);
    const answeredCount = activeAttemptDetails.answers?.length || 0;
    const progressPercent = (answeredCount / questions.length) * 100;

    return (
      <Card className="max-w-3xl mx-auto shadow-md border-gray-200">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <span className="font-medium text-sm text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</span>
          <div className="w-1/2 flex items-center gap-4">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs text-gray-500 font-medium">{Math.round(progressPercent)}%</span>
          </div>
        </div>
        <CardContent className="p-8">
          <h2 className="text-xl font-display font-medium text-gray-900 mb-8 leading-relaxed">{q.question}</h2>
          <RadioGroup
            value={existingAnswer ? String(existingAnswer.selectedOptionId) : undefined}
            onValueChange={(val) => submitAnswer(Number(val))}
            className="space-y-3"
          >
            {q.options.sort((a: any, b: any) => a.order - b.order).map((opt: any) => (
              <div key={opt.id} className={`flex items-center space-x-3 p-4 rounded-lg border ${existingAnswer?.selectedOptionId === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'} transition-all cursor-pointer`}>
                <RadioGroupItem value={String(opt.id)} id={`opt-${opt.id}`} />
                <Label htmlFor={`opt-${opt.id}`} className="flex-1 cursor-pointer text-base leading-relaxed font-normal">{opt.optionText}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-between">
          <Button variant="outline" onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={finishQuiz} disabled={finishMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {finishMutation.isPending ? "Submitting..." : "Finish & Submit"} <CheckCircle className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-sm border-gray-100 overflow-hidden text-center">
        <div className="bg-gray-50 p-8 border-b border-gray-100">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileQuestion className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">{quiz.title}</h2>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600 font-medium">
            <span className="flex items-center gap-1"><FileQuestion className="h-4 w-4" /> {quiz.questionCount} Questions</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {quiz.timeLimitMinutes || 'Unlimited'} time</span>
          </div>
        </div>
        <CardContent className="p-8">
          {bestAttempt ? (
            <div className="mb-8 p-6 bg-green-50 rounded-xl border border-green-100">
              <div className="text-green-800 font-medium mb-1">Your Best Score</div>
              <div className="text-4xl font-display font-bold text-green-700 flex items-center justify-center gap-2">
                {bestAttempt.score} <span className="text-xl text-green-600 font-medium">/ {bestAttempt.totalQuestions}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 mb-8">{quiz.description || "Read the questions carefully. You can review your answers before submitting."}</p>
          )}
          <Button size="lg" className="w-full sm:w-auto px-8" onClick={startQuiz} disabled={startMutation.isPending}>
            <PlayCircle className="mr-2 h-5 w-5" />
            {bestAttempt ? "Retake Quiz" : "Start Quiz Now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Staff Quiz Manager ───────────────────────────────────────────────────────

type OptionDraft = { text: string; isCorrect: boolean };

const emptyOptions = (): OptionDraft[] => [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

function StaffQuizManager({ quizId }: { quizId: number }) {
  const { data: quiz, refetch: refetchQuiz } = useGetQuiz(quizId);
  const { data: questions, refetch: refetchQuestions } = useListQuizQuestions(quizId);
  const createQuestionMutation = useCreateQuestion();
  const deleteQuestionMutation = useDeleteQuestion();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(emptyOptions());

  const setOptionText = (i: number, text: string) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, text } : o));
  };

  const setCorrect = (i: number) => {
    setOptions(prev => prev.map((o, idx) => ({ ...o, isCorrect: idx === i })));
  };

  const openAddQuestion = () => {
    setQuestionText("");
    setOptions(emptyOptions());
    setAddOpen(true);
  };

  const handleAddQuestion = () => {
    if (!questionText.trim()) {
      toast({ title: "Question text is required", variant: "destructive" }); return;
    }
    const filledOptions = options.filter(o => o.text.trim());
    if (filledOptions.length < 2) {
      toast({ title: "Add at least 2 answer options", variant: "destructive" }); return;
    }
    if (!filledOptions.some(o => o.isCorrect)) {
      toast({ title: "Mark one option as correct", variant: "destructive" }); return;
    }

    createQuestionMutation.mutate({
      id: quizId,
      data: {
        question: questionText.trim(),
        order: questions?.length || 0,
        options: filledOptions.map((o, i) => ({
          optionText: o.text.trim(),
          isCorrect: o.isCorrect,
          order: i,
        })),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Question added!" });
        setAddOpen(false);
        refetchQuestions();
        refetchQuiz();
      },
      onError: () => toast({ title: "Failed to add question", variant: "destructive" }),
    });
  };

  const handleDeleteQuestion = (qId: number, qText: string) => {
    if (!confirm(`Delete question "${qText.substring(0, 60)}..."?`)) return;
    deleteQuestionMutation.mutate({ id: qId }, {
      onSuccess: () => { toast({ title: "Question deleted" }); refetchQuestions(); refetchQuiz(); },
      onError: () => toast({ title: "Failed to delete question", variant: "destructive" }),
    });
  };

  const LETTERS = ['A', 'B', 'C', 'D'];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Quiz Header Card */}
      <Card className="mb-6 border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">Quiz Editor</Badge>
              <Badge variant="outline">{quiz?.questionCount || 0} Questions</Badge>
              {quiz?.timeLimitMinutes && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {quiz.timeLimitMinutes}m
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-display font-bold text-gray-900">{quiz?.title}</h2>
            {quiz?.description && <p className="text-sm text-gray-500 mt-1">{quiz.description}</p>}
          </div>
          <Button onClick={openAddQuestion}>
            <Plus className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </div>
      </Card>

      {/* Add Question Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label>Question *</Label>
              <Textarea
                rows={3}
                placeholder="e.g. Which CSS property controls the element's space outside its border?"
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Answer Options *</Label>
                <span className="text-xs text-gray-500">Click the circle to mark the correct answer</span>
              </div>
              {options.map((opt, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${opt.isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => setCorrect(i)}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${opt.isCorrect ? 'text-green-600' : 'text-gray-300 hover:text-gray-500'}`}
                    title="Mark as correct"
                  >
                    {opt.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                    {LETTERS[i]}
                  </div>
                  <Input
                    placeholder={`Option ${LETTERS[i]}${i === 0 ? ' (correct answer)' : ''}`}
                    value={opt.text}
                    onChange={e => setOptionText(i, e.target.value)}
                    className={`flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 ${opt.isCorrect ? 'font-medium' : ''}`}
                  />
                </div>
              ))}
              <p className="text-xs text-gray-400">Leave option fields blank to omit them. At least 2 options and 1 correct answer required.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddQuestion} disabled={createQuestionMutation.isPending}>
              {createQuestionMutation.isPending ? "Adding..." : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions List */}
      {!questions || questions.length === 0 ? (
        <div className="text-center p-16 bg-white rounded-xl border border-dashed border-gray-300">
          <FileQuestion className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
          <p className="text-gray-500 mb-4">Start adding questions to this quiz.</p>
          <Button onClick={openAddQuestion}>
            <Plus className="mr-2 h-4 w-4" /> Add First Question
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.sort((a: any, b: any) => a.order - b.order).map((q: any, i: number) => (
            <Card key={q.id} className="border-gray-200 shadow-sm overflow-hidden group">
              <CardHeader className="bg-gray-50 border-b border-gray-100 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-display font-bold text-sm shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-base font-medium text-gray-900 leading-relaxed">{q.question}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteQuestion(q.id, q.question)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {q.options.sort((a: any, b: any) => a.order - b.order).map((opt: any, oi: number) => (
                    <div key={opt.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${opt.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-transparent'}`}>
                      {opt.isCorrect
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                      }
                      <div className="w-5 h-5 text-xs font-bold text-gray-400">{LETTERS[oi]}</div>
                      <span className={`text-sm ${opt.isCorrect ? 'font-medium text-green-800' : 'text-gray-700'}`}>{opt.optionText}</span>
                      {opt.isCorrect && <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">Correct</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

export default function QuizDetail() {
  const params = useParams();
  const quizId = Number(params.id);
  const { data: me } = useGetMe();
  const { data: quiz, isLoading } = useGetQuiz(quizId);

  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 max-w-2xl mx-auto rounded-xl" /></div>;
  if (!quiz) return <div className="p-8 text-center text-gray-500">Quiz not found.</div>;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto pb-24">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-3 text-gray-500">
        <Link href="/quizzes">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Quizzes
        </Link>
      </Button>

      {isStaff ? (
        <StaffQuizManager quizId={quizId} />
      ) : (
        <StudentQuizTaker quizId={quizId} quiz={quiz} />
      )}
    </div>
  );
}
