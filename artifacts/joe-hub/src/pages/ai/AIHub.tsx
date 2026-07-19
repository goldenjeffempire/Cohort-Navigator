/**
 * AI Hub — the central landing page for all AI features.
 */
import { Link } from "wouter";
import { useLearningInsights } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles, BotMessageSquare, Code2, FileText, Mic,
  Briefcase, HelpCircle, BookOpen, ArrowRight, AlertTriangle,
  TrendingUp, Star,
} from "lucide-react";

const AI_TOOLS = [
  {
    icon: BotMessageSquare,
    title: "AI Learning Tutor",
    description: "24/7 learning assistant. Ask any question about your courses, get step-by-step explanations, and guided problem solving.",
    href: "/ai/tutor",
    color: "bg-blue-50 text-blue-600 border-blue-100",
    badge: "Tutor",
  },
  {
    icon: Code2,
    title: "AI Code Assistant",
    description: "Get code explanations, bug detection, hints for challenges, and refactoring suggestions. Available in your coding workspace.",
    href: "/challenges",
    color: "bg-violet-50 text-violet-600 border-violet-100",
    badge: "Code",
  },
  {
    icon: FileText,
    title: "Assignment Feedback",
    description: "Get intelligent feedback on your assignments — quality analysis, rubric-based scoring, and improvement recommendations.",
    href: "/assignments",
    color: "bg-amber-50 text-amber-600 border-amber-100",
    badge: "Assignments",
  },
  {
    icon: Mic,
    title: "AI Interview Coach",
    description: "Practice technical and behavioral interviews with our AI coach. Get realistic questions and detailed answer evaluations.",
    href: "/ai/interview",
    color: "bg-green-50 text-green-600 border-green-100",
    badge: "Interview",
  },
  {
    icon: Briefcase,
    title: "Career Assistant",
    description: "Resume review, GitHub analysis, LinkedIn optimisation, and a personalised career roadmap to land your dream job.",
    href: "/ai/career",
    color: "bg-rose-50 text-rose-600 border-rose-100",
    badge: "Career",
  },
  {
    icon: HelpCircle,
    title: "AI Quiz Generator",
    description: "Generate unlimited practice questions on any topic to test your knowledge and prepare for assessments.",
    href: "/ai/tutor",
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
    badge: "Quiz",
  },
];

const INSIGHT_ICONS: Record<string, typeof Star> = {
  strength: Star,
  weakness: AlertTriangle,
  recommendation: TrendingUp,
  risk: AlertTriangle,
};
const INSIGHT_COLORS: Record<string, string> = {
  strength: "text-green-600 bg-green-50 border-green-100",
  weakness: "text-amber-600 bg-amber-50 border-amber-100",
  recommendation: "text-blue-600 bg-blue-50 border-blue-100",
  risk: "text-red-600 bg-red-50 border-red-100",
};

export default function AIHub() {
  const { data: insightsData } = useLearningInsights();
  const insights = insightsData?.insights ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-violet-700 p-8 text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white_0%,_transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-6 w-6" />
            <span className="text-sm font-medium opacity-80">Native AI Platform</span>
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">JOE AI</h1>
          <p className="text-white/80 max-w-xl">
            A fully self-hosted AI ecosystem powering your entire learning journey — tutor, code assistant, interview coach, and career advisor, all running on JOE Forge's own infrastructure.
          </p>
          <div className="flex gap-3 mt-5">
            <Link href="/ai/tutor">
              <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">
                Start Learning <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link href="/ai/interview">
              <Button variant="ghost" className="text-white border border-white/30 hover:bg-white/10">
                Mock Interview
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Learning Insights */}
      {insights.length > 0 && (
        <section>
          <h2 className="text-lg font-display font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Your AI Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.slice(0, 4).map((insight, i) => {
              const Icon = INSIGHT_ICONS[insight.type] ?? Star;
              const color = INSIGHT_COLORS[insight.type] ?? "text-gray-600 bg-gray-50 border-gray-100";
              return (
                <div key={i} className={`flex gap-3 p-3 rounded-xl border ${color}`}>
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{insight.topic}</div>
                    <div className="text-xs opacity-80 mt-0.5">{insight.detail}</div>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-xs border-current">
                    {insight.priority}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI Tools grid */}
      <section>
        <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" /> AI Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_TOOLS.map((tool) => (
            <Link key={tool.title} href={tool.href}>
              <Card className="h-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group border border-gray-100">
                <CardHeader className="pb-2">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${tool.color}`}>
                    <tool.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    {tool.title}
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500 leading-relaxed">{tool.description}</p>
                  <Badge variant="outline" className="mt-3 text-xs">{tool.badge}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Architecture note */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-500 flex gap-3">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-medium text-gray-700">Self-hosted AI Platform: </span>
          JOE Forge's AI runs on its own infrastructure using a retrieval-augmented generation (RAG) engine backed by the platform's knowledge base.
          For higher-capacity AI, connect a local model server (Ollama/vLLM) via the Admin AI Dashboard and set <code>AI_MODEL_ENDPOINT</code>.
        </div>
      </div>
    </div>
  );
}
