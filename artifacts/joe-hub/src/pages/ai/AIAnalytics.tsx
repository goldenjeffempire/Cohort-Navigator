/**
 * AI Analytics — personal learning analytics dashboard
 *
 * Shows:
 * - Competency score + risk level
 * - Skill scores radar / bar chart
 * - Weak / strong topics
 * - Learning recommendations
 * - Performance forecast
 * - AI usage breakdown
 */
import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  ChevronRight, Zap, Target, BookOpen, Users, Star, ArrowLeft,
  RefreshCw, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StudentAnalytics {
  userId: number;
  challengesAttempted: number;
  challengesPassed: number;
  challengePassRate: number;
  avgChallengeScore: number;
  totalAIConversations: number;
  totalAIMessages: number;
  aiConversationsByMode: Record<string, number>;
  avgAIRating: number | null;
  activeDays: number;
  longestStreakDays: number;
  competencyScore: number;
  riskLevel: "none" | "low" | "medium" | "high";
  weakTopics: string[];
  strongTopics: string[];
  learningVelocity: number;
  skillScores: Record<string, number>;
  engagementScore: number;
  performanceScore: number;
}

interface LearningRecommendation {
  type: string;
  skillArea: string;
  detail: string;
  priority: "high" | "medium" | "low";
  actionItems: string[];
}

interface Forecast {
  predictedCompetencyScore: number;
  confidenceLevel: "high" | "medium" | "low";
  weeksToTargetScore: number | null;
  trend: "improving" | "stable" | "declining";
  onTrackForCompletion: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function riskColor(level: string): string {
  return level === "high" ? "text-red-600" : level === "medium" ? "text-amber-600" : level === "low" ? "text-yellow-600" : "text-green-600";
}

function riskBadgeVariant(level: string): "destructive" | "secondary" | "default" | "outline" {
  if (level === "high") return "destructive";
  if (level === "medium") return "secondary";
  return "default";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (trend === "declining") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CompetencyCard({ analytics }: { analytics: StudentAnalytics }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Overall Competency</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={`text-5xl font-bold font-display ${scoreColor(analytics.competencyScore)}`}>
            {analytics.competencyScore}
          </span>
          <span className="text-2xl font-bold text-muted-foreground pb-1">/ 100</span>
          <span className={`text-2xl font-bold pb-1 ml-2 ${scoreColor(analytics.competencyScore)}`}>
            {scoreGrade(analytics.competencyScore)}
          </span>
        </div>
        <div className="mt-3">
          <Progress value={analytics.competencyScore} className="h-2" />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant={riskBadgeVariant(analytics.riskLevel)} className="capitalize">
            {analytics.riskLevel === "none" ? "On Track" : `${analytics.riskLevel} Risk`}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {analytics.learningVelocity.toFixed(1)} items/week
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EngagementCard({ analytics }: { analytics: StudentAnalytics }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Engagement Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={`text-5xl font-bold font-display ${scoreColor(analytics.engagementScore)}`}>
            {analytics.engagementScore}
          </span>
          <span className="text-2xl text-muted-foreground pb-1">/ 100</span>
        </div>
        <div className="mt-3">
          <Progress value={analytics.engagementScore} className="h-2" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div><span className="font-medium text-foreground">{analytics.activeDays}</span> active days</div>
          <div><span className="font-medium text-foreground">{analytics.longestStreakDays}</span> day streak</div>
          <div><span className="font-medium text-foreground">{analytics.totalAIMessages}</span> AI messages</div>
          <div><span className="font-medium text-foreground">{analytics.challengesPassed}</span> passed</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceCard({ analytics }: { analytics: StudentAnalytics }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Performance Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={`text-5xl font-bold font-display ${scoreColor(analytics.performanceScore)}`}>
            {analytics.performanceScore}
          </span>
          <span className="text-2xl text-muted-foreground pb-1">/ 100</span>
        </div>
        <div className="mt-3">
          <Progress value={analytics.performanceScore} className="h-2" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div><span className="font-medium text-foreground">{analytics.challengesAttempted}</span> challenges</div>
          <div><span className="font-medium text-foreground">{analytics.challengePassRate.toFixed(0)}%</span> pass rate</div>
          <div><span className="font-medium text-foreground">{analytics.avgChallengeScore}</span> avg score</div>
          <div><span className="font-medium text-foreground">{analytics.avgAIRating?.toFixed(1) ?? "—"}/5</span> AI rating</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillScoresCard({ skillScores, weakTopics, strongTopics }: { skillScores: Record<string, number>; weakTopics: string[]; strongTopics: string[] }) {
  const entries = Object.entries(skillScores).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Skill Scores</CardTitle>
          <CardDescription>Complete challenges and quizzes to build your skill profile.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Skill Scores</CardTitle>
        <CardDescription>Based on your challenge submissions, quizzes, and AI interactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map(([topic, score]) => {
            const isWeak   = weakTopics.includes(topic);
            const isStrong = strongTopics.includes(topic);
            return (
              <div key={topic}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium capitalize">{topic.replace(/-/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    {isStrong && <Star className="h-3 w-3 text-amber-500" />}
                    {isWeak && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
                  </div>
                </div>
                <Progress value={score} className="h-1.5" />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" /> Strong (&gt;80)</div>
          <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Weak (&lt;60)</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastCard({ forecast }: { forecast: Forecast }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Performance Forecast
        </CardTitle>
        <CardDescription>Projected competency based on your current trajectory</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <TrendIcon trend={forecast.trend} />
          <div>
            <p className="font-semibold capitalize">{forecast.trend}</p>
            <p className="text-xs text-muted-foreground">
              Confidence: {forecast.confidenceLevel}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold ${scoreColor(forecast.predictedCompetencyScore)}`}>
              {forecast.predictedCompetencyScore}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Predicted score</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            {forecast.onTrackForCompletion ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto" />
                <p className="text-xs text-muted-foreground mt-1">On track</p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
                <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
              </>
            )}
          </div>
        </div>
        {forecast.weeksToTargetScore !== null && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Estimated <strong>{forecast.weeksToTargetScore} week{forecast.weeksToTargetScore !== 1 ? "s" : ""}</strong> to reach 70+ competency
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationsCard({ recommendations }: { recommendations: LearningRecommendation[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Keep completing challenges to generate personalised recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Recommendations</CardTitle>
        <CardDescription>Personalised actions to improve your scores</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => setExpanded(expanded === i ? null : i)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "secondary" : "outline"} className="text-xs">
                      {rec.priority}
                    </Badge>
                    <span className="text-sm font-medium capitalize">{rec.skillArea.replace(/-/g, " ")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{rec.detail}</p>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded === i ? "rotate-90" : ""}`} />
              </div>
              {expanded === i && rec.actionItems.length > 0 && (
                <ul className="mt-3 space-y-1 border-t pt-2">
                  {rec.actionItems.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AIUsageCard({ analytics }: { analytics: StudentAnalytics }) {
  const byMode = Object.entries(analytics.aiConversationsByMode)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const total = byMode.reduce((s, [, c]) => s + c, 0) || 1;

  const modeColors: Record<string, string> = {
    tutor: "bg-blue-500", code: "bg-green-500", interview: "bg-purple-500",
    career: "bg-amber-500", quiz: "bg-pink-500", assignment: "bg-orange-500",
    review: "bg-teal-500", general: "bg-gray-500",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> AI Usage</CardTitle>
        <CardDescription>{analytics.totalAIConversations} conversations · {analytics.totalAIMessages} messages</CardDescription>
      </CardHeader>
      <CardContent>
        {byMode.length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI conversations yet. <Link href="/ai" className="text-primary hover:underline">Start chatting</Link></p>
        ) : (
          <div className="space-y-2">
            {byMode.map(([mode, count]) => (
              <div key={mode}>
                <div className="flex justify-between mb-1 text-xs">
                  <span className="capitalize font-medium">{mode}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${modeColors[mode] ?? "bg-primary"}`}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AIAnalytics() {
  const { data: me } = useGetMe();

  const { data: analytics, isLoading: analyticsLoading, refetch } = useQuery({
    queryKey: ["ai-student-analytics", me?.id],
    queryFn: () => customFetch<StudentAnalytics>(`/api/ai/analytics/student/${me!.id}`),
    enabled: !!me?.id,
  });

  const { data: profileData } = useQuery({
    queryKey: ["ai-learning-profile"],
    queryFn: () => customFetch<{ profile: { recommendations: LearningRecommendation[] } }>("/api/ai/learning/profile"),
    enabled: !!me?.id,
  });

  const { data: forecastData } = useQuery({
    queryKey: ["ai-forecast"],
    queryFn: () => customFetch<Forecast>("/api/ai/learning/forecast?weeksRemaining=8"),
    enabled: !!me?.id,
  });

  if (analyticsLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No analytics data yet. Complete some challenges to get started!</p>
        <Link href="/challenges">
          <Button className="mt-4">Browse Challenges</Button>
        </Link>
      </div>
    );
  }

  const recommendations = profileData?.profile?.recommendations ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ai">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              My Learning Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Your personalised competency profile and progress insights</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CompetencyCard analytics={analytics} />
        <EngagementCard analytics={analytics} />
        <PerformanceCard analytics={analytics} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkillScoresCard
          skillScores={analytics.skillScores}
          weakTopics={analytics.weakTopics}
          strongTopics={analytics.strongTopics}
        />
        <div className="space-y-4">
          {forecastData && <ForecastCard forecast={forecastData} />}
          <AIUsageCard analytics={analytics} />
        </div>
      </div>

      {/* Recommendations */}
      <RecommendationsCard recommendations={recommendations} />

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "AI Tutor", href: "/ai/tutor", icon: Brain, desc: "Get help learning" },
          { label: "Challenges", href: "/challenges", icon: Target, desc: "Build skills" },
          { label: "Interview Prep", href: "/ai/interview", icon: Users, desc: "Practice interviews" },
          { label: "Career Coach", href: "/ai/career", icon: BookOpen, desc: "Plan your path" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="p-3 hover:bg-muted/30 transition-colors cursor-pointer h-full">
              <item.icon className="h-5 w-5 text-primary mb-1" />
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
