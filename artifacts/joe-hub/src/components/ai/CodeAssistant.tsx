/**
 * CodeAssistant — inline panel for the coding workspace.
 * Provides code analysis, hints, explanations, and full review.
 */
import { useState } from "react";
import { useAnalyzeCode, streamAITool, type CodeQualityReport } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lightbulb, Bug, Zap, CheckCircle2, AlertCircle, Info,
  Loader2, SparklesIcon, BarChart3,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  code: string;
  language?: string;
  challengeTitle?: string;
  problemDescription?: string;
}

const ISSUE_ICONS: Record<string, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};
const ISSUE_COLORS: Record<string, string> = {
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  const color = score >= 80 ? "bg-green-100 text-green-700" : score >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${color}`}>
      <span>{grade}</span>
      <span className="text-xs font-normal opacity-70">{score}/100</span>
    </div>
  );
}

function StreamingPanel({ content, loading }: { content: string; loading: boolean }) {
  return (
    <div className="p-4 text-sm">
      {loading && !content && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>JOE AI is thinking…</span>
        </div>
      )}
      {content && (
        <div className="prose prose-sm prose-gray max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
          {loading && <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 rounded-sm" />}
        </div>
      )}
    </div>
  );
}

export default function CodeAssistant({ code, language = "javascript", challengeTitle, problemDescription }: Props) {
  const [report, setReport] = useState<CodeQualityReport | null>(null);
  const [hintText, setHintText] = useState("");
  const [explainText, setExplainText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const analyzeCode = useAnalyzeCode();

  const setLoad = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  const runAnalysis = async () => {
    setLoad("analyze", true);
    const result = await analyzeCode.mutateAsync({ code, language });
    setReport(result);
    setLoad("analyze", false);
  };

  const runHint = async () => {
    if (!code.trim()) return;
    setLoad("hint", true);
    setHintText("");
    await streamAITool(
      "/ai/code/hint",
      { code, language, challengeTitle, problemDescription },
      {
        onChunk: (c) => setHintText((p) => p + c),
        onDone: () => setLoad("hint", false),
        onError: (e) => { setHintText(`Error: ${e}`); setLoad("hint", false); },
      },
    );
  };

  const runExplain = async () => {
    if (!code.trim()) return;
    setLoad("explain", true);
    setExplainText("");
    await streamAITool(
      "/ai/code/explain",
      { code, language },
      {
        onChunk: (c) => setExplainText((p) => p + c),
        onDone: () => setLoad("explain", false),
        onError: (e) => { setExplainText(`Error: ${e}`); setLoad("explain", false); },
      },
    );
  };

  const runReview = async () => {
    if (!code.trim()) return;
    setLoad("review", true);
    setReviewText("");
    await streamAITool(
      "/ai/code/review",
      { code, language, context: challengeTitle },
      {
        onChunk: (c) => setReviewText((p) => p + c),
        onDone: () => setLoad("review", false),
        onError: (e) => { setReviewText(`Error: ${e}`); setLoad("review", false); },
      },
    );
  };

  return (
    <div className="h-full flex flex-col border-l border-gray-100">
      <div className="p-3 border-b flex items-center gap-2 shrink-0">
        <SparklesIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-gray-900">AI Code Assistant</h3>
      </div>

      <Tabs defaultValue="analyze" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 mx-3 mt-2 grid grid-cols-4 h-8">
          <TabsTrigger value="analyze" className="text-xs"><BarChart3 className="h-3 w-3 mr-1" />Analyse</TabsTrigger>
          <TabsTrigger value="hint" className="text-xs"><Lightbulb className="h-3 w-3 mr-1" />Hint</TabsTrigger>
          <TabsTrigger value="explain" className="text-xs"><Info className="h-3 w-3 mr-1" />Explain</TabsTrigger>
          <TabsTrigger value="review" className="text-xs"><Bug className="h-3 w-3 mr-1" />Review</TabsTrigger>
        </TabsList>

        {/* Analyse tab */}
        <TabsContent value="analyze" className="flex-1 overflow-auto p-3 space-y-3">
          <Button size="sm" className="w-full" onClick={runAnalysis} disabled={!code.trim() || loading.analyze}>
            {loading.analyze ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            {loading.analyze ? "Analysing…" : "Analyse Code"}
          </Button>
          {report && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Code Quality</span>
                <ScoreBadge score={report.score} grade={report.grade} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Lines", value: report.metrics.linesOfCode },
                  { label: "Functions", value: report.metrics.functionCount },
                  { label: "Nesting", value: report.metrics.maxNesting },
                  { label: "Comment %", value: `${Math.round(report.metrics.commentRatio * 100)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="font-semibold text-gray-900">{value}</div>
                    <div className="text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
              {report.issues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700">Issues:</p>
                  {report.issues.map((issue, i) => {
                    const Icon = ISSUE_ICONS[issue.type];
                    return (
                      <div key={i} className="flex gap-2 text-xs bg-gray-50 rounded-lg p-2">
                        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${ISSUE_COLORS[issue.type]}`} />
                        <div>
                          <div className="text-gray-700">{issue.message}</div>
                          {issue.suggestion && <div className="text-gray-400 mt-0.5">{issue.suggestion}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {report.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">Suggestions:</p>
                  {report.suggestions.map((s, i) => (
                    <div key={i} className="flex gap-1.5 text-xs text-gray-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Hint tab */}
        <TabsContent value="hint" className="flex-1 overflow-auto">
          <div className="p-3">
            <Button size="sm" className="w-full" onClick={runHint} disabled={!code.trim() || loading.hint}>
              {loading.hint ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Lightbulb className="h-3.5 w-3.5 mr-1" />}
              {loading.hint ? "Getting hint…" : "Get a Hint"}
            </Button>
            <p className="text-xs text-gray-400 text-center mt-2">Hint won't reveal the full solution.</p>
          </div>
          {(hintText || loading.hint) && <StreamingPanel content={hintText} loading={loading.hint} />}
        </TabsContent>

        {/* Explain tab */}
        <TabsContent value="explain" className="flex-1 overflow-auto">
          <div className="p-3">
            <Button size="sm" className="w-full" onClick={runExplain} disabled={!code.trim() || loading.explain}>
              {loading.explain ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Info className="h-3.5 w-3.5 mr-1" />}
              {loading.explain ? "Explaining…" : "Explain My Code"}
            </Button>
          </div>
          {(explainText || loading.explain) && <StreamingPanel content={explainText} loading={loading.explain} />}
        </TabsContent>

        {/* Review tab */}
        <TabsContent value="review" className="flex-1 overflow-auto">
          <div className="p-3">
            <Button size="sm" className="w-full" onClick={runReview} disabled={!code.trim() || loading.review}>
              {loading.review ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Bug className="h-3.5 w-3.5 mr-1" />}
              {loading.review ? "Reviewing…" : "Full Code Review"}
            </Button>
          </div>
          {(reviewText || loading.review) && <StreamingPanel content={reviewText} loading={loading.review} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
