import { Link } from "wouter";
import { useGetCodingProgress, useGetLeaderboard, useListChallenges } from "@/lib/coding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flame, Trophy, Code2, CheckCircle2, Zap, ChevronRight,
  BarChart3, TrendingUp, Award,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  passed: "text-green-600 bg-green-50 border-green-200",
  partial: "text-yellow-600 bg-yellow-50 border-yellow-200",
  failed: "text-red-600 bg-red-50 border-red-200",
  error: "text-red-600 bg-red-50 border-red-200",
  timeout: "text-orange-600 bg-orange-50 border-orange-200",
  pending: "text-gray-600 bg-gray-50 border-gray-200",
  running: "text-blue-600 bg-blue-50 border-blue-200",
};

export default function CodingProgress() {
  const { data: progress, isLoading } = useGetCodingProgress();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: challenges } = useListChallenges();

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const streak = progress?.streak;
  const totalChallenges = challenges?.length ?? 0;
  const completionRate = totalChallenges > 0
    ? Math.round(((progress?.solvedChallenges ?? 0) / totalChallenges) * 100)
    : 0;

  // Language breakdown for mini bar chart
  const langEntries = Object.entries(progress?.languageBreakdown ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxLangCount = langEntries[0]?.[1] ?? 1;

  const LANG_LABELS: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    bash: "Bash",
    html: "HTML",
    css: "CSS",
    sql: "SQL",
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Coding Progress</h1>
          <p className="text-gray-500 mt-1">Track your coding activity and performance.</p>
        </div>
        <Button asChild>
          <Link href="/challenges">
            <Code2 className="mr-2 h-4 w-4" /> Practice More
          </Link>
        </Button>
      </div>

      {/* Streak + Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Streak */}
        <Card className="border-orange-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-gray-900">
                  {streak?.currentStreak ?? 0}
                </div>
                <div className="text-xs text-gray-500">Day Streak</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Best: {streak?.longestStreak ?? 0} days
            </div>
          </CardContent>
        </Card>

        {/* Solved */}
        <Card className="border-green-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-gray-900">
                  {progress?.solvedChallenges ?? 0}
                </div>
                <div className="text-xs text-gray-500">Solved</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              {completionRate}% of available challenges
            </div>
          </CardContent>
        </Card>

        {/* Points */}
        <Card className="border-amber-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-gray-900">
                  {progress?.totalPoints ?? 0}
                </div>
                <div className="text-xs text-gray-500">Points Earned</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Across {progress?.totalSubmissions ?? 0} submissions
            </div>
          </CardContent>
        </Card>

        {/* Executions */}
        <Card className="border-blue-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-gray-900">
                  {progress?.totalExecutions ?? 0}
                </div>
                <div className="text-xs text-gray-500">Code Runs</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Times you hit "Run Code"
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* Recent submissions */}
        <Card className="col-span-full lg:col-span-2 shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Recent Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!progress?.recentSubmissions?.length ? (
              <div className="p-8 text-center text-gray-400 text-sm">No submissions yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {progress.recentSubmissions.map((sub) => (
                  <Link key={sub.id} href={`/challenges/${sub.challengeId}`}>
                    <div className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors">
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs shrink-0 ${STATUS_COLORS[sub.status] ?? ""}`}
                      >
                        {sub.status}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {sub.challengeTitle ?? `Challenge #${sub.challengeId}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(sub.submittedAt), "MMM d, yyyy · h:mm a")}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-700 shrink-0">
                        {sub.score} pts
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Language breakdown */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Language Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {langEntries.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">No data yet.</div>
            ) : (
              <div className="space-y-3">
                {langEntries.map(([lang, count]) => (
                  <div key={lang}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{LANG_LABELS[lang] ?? lang}</span>
                      <span className="text-gray-500 text-xs">{count} submissions</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(count / maxLangCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard */}
        {leaderboard && leaderboard.length > 0 && (
          <Card className="col-span-full shadow-sm border-gray-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {leaderboard.slice(0, 10).map((entry) => (
                  <div key={entry.userId} className="px-6 py-3 flex items-center gap-4">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-display font-bold shrink-0 ${
                      entry.rank === 1 ? "bg-amber-100 text-amber-700" :
                      entry.rank === 2 ? "bg-gray-100 text-gray-600" :
                      entry.rank === 3 ? "bg-orange-100 text-orange-700" :
                      "bg-gray-50 text-gray-500"
                    }`}>
                      {entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{entry.name}</div>
                      <div className="text-xs text-gray-400">{entry.solvedCount} solved</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700 shrink-0">
                      {entry.totalPoints} pts
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
