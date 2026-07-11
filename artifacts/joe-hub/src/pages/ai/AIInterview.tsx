/**
 * AI Interview Coach — mock technical interviews with evaluation.
 */
import { useState } from "react";
import { streamAITool } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mic, ChevronRight, Trophy, RotateCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

const TOPICS = ["Data Structures", "Algorithms", "System Design", "React", "Node.js", "Python", "SQL", "Behavioral", "DevOps", "General CS"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const TYPES = ["technical", "behavioral", "coding", "system_design"];

interface Question {
  text: string;
  topic: string;
  difficulty: string;
}
interface EvalResult {
  text: string;
  question: Question;
}

function StreamingText({ text, loading }: { text: string; loading: boolean }) {
  return (
    <div className="prose prose-sm max-w-none text-gray-700">
      <ReactMarkdown>{text}</ReactMarkdown>
      {loading && <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse rounded-sm ml-0.5" />}
    </div>
  );
}

export default function AIInterview() {
  const [topic, setTopic] = useState("Data Structures");
  const [difficulty, setDifficulty] = useState("medium");
  const [type, setType] = useState("technical");
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
  const [evaluationText, setEvaluationText] = useState("");
  const [session, setSession] = useState<Question[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState("practice");

  const setLoad = (k: string, v: boolean) => setLoading((p) => ({ ...p, [k]: v }));

  const generateQuestion = async () => {
    setLoad("question", true);
    setQuestionText("");
    setAnswer("");
    setEvaluation(null);
    setEvaluationText("");

    let accumulated = "";
    await streamAITool("/ai/interview/question", {
      topic, difficulty, type,
      previousQuestions: session.map((q) => q.topic),
    }, {
      onChunk: (c) => { accumulated += c; setQuestionText(accumulated); },
      onDone: () => {
        const q = { text: accumulated, topic, difficulty };
        setQuestion(q);
        setSession((prev) => [...prev, q]);
        setLoad("question", false);
      },
      onError: () => setLoad("question", false),
    });
  };

  const evaluateAnswer = async () => {
    if (!question || !answer.trim()) return;
    setLoad("eval", true);
    setEvaluationText("");

    let acc = "";
    await streamAITool("/ai/interview/evaluate", {
      question: question.text, answer,
    }, {
      onChunk: (c) => { acc += c; setEvaluationText(acc); },
      onDone: () => {
        setEvaluation({ text: acc, question });
        setLoad("eval", false);
      },
      onError: () => setLoad("eval", false),
    });
  };

  const reset = () => {
    setQuestion(null); setQuestionText(""); setAnswer("");
    setEvaluation(null); setEvaluationText("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Mic className="h-5 w-5" />
          <span className="text-sm font-medium opacity-80">AI Interview Coach</span>
        </div>
        <h1 className="text-2xl font-display font-bold">Mock Interview Practice</h1>
        <p className="text-white/80 text-sm mt-1">AI-generated questions with real-time answer evaluation and detailed feedback.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="practice">Practice Session</TabsTrigger>
          <TabsTrigger value="history">Session History ({session.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="practice" className="space-y-4 mt-4">
          {/* Config */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Interview Setup</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Topic</label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TOPICS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Difficulty</label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="h-9 text-sm capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-9 text-sm capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-3 w-full" onClick={generateQuestion} disabled={loading.question}>
                {loading.question ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                {loading.question ? "Generating…" : question ? "Next Question" : "Start Interview"}
              </Button>
            </CardContent>
          </Card>

          {/* Question */}
          {(questionText || loading.question) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Interview Question</CardTitle>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-xs capitalize">{topic}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{difficulty}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <StreamingText text={questionText} loading={loading.question} />
              </CardContent>
            </Card>
          )}

          {/* Answer */}
          {question && !loading.question && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Answer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here. Think out loud — explain your reasoning, approach, and solution. The more detail, the better the feedback."
                  className="min-h-32 text-sm" />
                <div className="flex gap-2">
                  <Button onClick={evaluateAnswer} disabled={!answer.trim() || loading.eval} className="flex-1">
                    {loading.eval ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {loading.eval ? "Evaluating…" : "Get AI Feedback"}
                  </Button>
                  <Button variant="outline" onClick={reset} className="px-3"><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evaluation */}
          {(evaluationText || loading.eval) && (
            <Card className="border-green-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-green-600" /> AI Evaluation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StreamingText text={evaluationText} loading={loading.eval} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {session.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Mic className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No questions answered yet. Start a practice session!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {session.map((q, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-400">Q{i + 1}</span>
                    <Badge variant="outline" className="text-xs capitalize">{q.topic}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{q.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{q.text.replace(/\*\*/g, "").slice(0, 200)}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
