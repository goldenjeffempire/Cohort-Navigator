import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetQuiz, useStartQuizAttempt, useListMyQuizAttempts, useGetAttempt, useListQuizQuestions, useSubmitAnswer, useSubmitQuizAttempt, useGetMe, getGetAttemptQueryKey, getListQuizQuestionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Clock, FileQuestion, CheckCircle, AlertTriangle, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StudentQuizTaker({ quizId, quiz }: { quizId: number, quiz: any }) {
  const { data: attempts, refetch: refetchAttempts } = useListMyQuizAttempts(quizId);
  const startMutation = useStartQuizAttempt();
  const submitAnswerMutation = useSubmitAnswer();
  const finishMutation = useSubmitQuizAttempt();
  const { toast } = useToast();

  const activeAttempt = attempts?.find(a => a.status === 'in_progress');
  const completedAttempts = attempts?.filter(a => a.status === 'completed');
  const bestAttempt = completedAttempts?.sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const { data: activeAttemptDetails, refetch: refetchDetails } = useGetAttempt(activeAttempt?.id || 0, { query: { enabled: !!activeAttempt, queryKey: getGetAttemptQueryKey(activeAttempt?.id || 0) } });
  const { data: questions } = useListQuizQuestions(quizId, { query: { enabled: !!activeAttempt, queryKey: getListQuizQuestionsQueryKey(quizId) } });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const startQuiz = () => {
    startMutation.mutate({ id: quizId }, {
      onSuccess: () => {
        refetchAttempts();
      },
      onError: (err) => {
        toast({ title: "Cannot start quiz", description: err.message, variant: "destructive" });
      }
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

    // find if answered
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
          <h2 className="text-xl font-display font-medium text-gray-900 mb-8 leading-relaxed">
            {q.question}
          </h2>
          
          <RadioGroup 
            value={existingAnswer ? String(existingAnswer.selectedOptionId) : undefined} 
            onValueChange={(val) => submitAnswer(Number(val))}
            className="space-y-3"
          >
            {q.options.sort((a,b) => a.order - b.order).map(opt => (
              <div key={opt.id} className={`flex items-center space-x-3 p-4 rounded-lg border ${existingAnswer?.selectedOptionId === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'} transition-all cursor-pointer`}>
                <RadioGroupItem value={String(opt.id)} id={`opt-${opt.id}`} />
                <Label htmlFor={`opt-${opt.id}`} className="flex-1 cursor-pointer text-base leading-relaxed font-normal">{opt.optionText}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          
          {currentQuestionIndex === questions.length - 1 ? (
             <Button onClick={finishQuiz} disabled={finishMutation.isPending} className="bg-green-600 hover:bg-green-700">
               {finishMutation.isPending ? "Submitting..." : "Finish & Submit"} <CheckCircle className="ml-2 h-4 w-4" />
             </Button>
          ) : (
            <Button 
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Not in progress view
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-sm border-gray-100 overflow-hidden text-center">
        <div className="bg-gray-50 p-8 border-b border-gray-100">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileQuestion className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">{quiz.title}</h2>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600 font-medium">
             <span className="flex items-center gap-1"><FileQuestion className="h-4 w-4"/> {quiz.questionCount} Questions</span>
             <span className="flex items-center gap-1"><Clock className="h-4 w-4"/> {quiz.timeLimitMinutes || 'Unlimited'} time</span>
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

function StaffQuizManager({ quizId }: { quizId: number }) {
  return (
    <div className="text-center p-12 bg-white rounded-xl border border-gray-200">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Quiz Editor</h3>
      <p className="text-gray-500">Staff view for managing questions is under construction.</p>
    </div>
  )
}

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
