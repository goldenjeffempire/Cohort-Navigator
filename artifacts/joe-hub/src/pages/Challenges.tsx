import { useState } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  useListChallenges,
  type ChallengeDifficulty,
  type ChallengeType,
  type CodingLanguage,
} from "@/lib/coding";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Code2, ChevronRight, CheckCircle2, Clock, Zap, Filter, Terminal,
  Trophy, BookOpen,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<ChallengeDifficulty, string> = {
  easy: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  hard: "bg-red-100 text-red-800 border-red-200",
};

const TYPE_LABELS: Record<ChallengeType, string> = {
  practice: "Practice",
  assessment: "Assessment",
  capstone: "Capstone",
  weekly: "Weekly",
};

const LANG_ICONS: Record<string, string> = {
  javascript: "JS",
  typescript: "TS",
  python: "PY",
  bash: "SH",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Challenges() {
  const { data: me } = useGetMe();
  const isStaff = me?.role === "admin" || me?.role === "mentor";

  const [difficulty, setDifficulty] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: challenges, isLoading } = useListChallenges(
    isStaff ? { all: true } : undefined,
  );

  const filtered = challenges?.filter((c) => {
    if (difficulty !== "all" && c.difficulty !== difficulty) return false;
    if (type !== "all" && c.type !== type) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = challenges
    ? {
        total: challenges.length,
        solved: challenges.filter((c) => c.mySolved).length,
        attempted: challenges.filter((c) => (c.myAttempts ?? 0) > 0).length,
      }
    : null;

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Coding Challenges</h1>
          <p className="text-gray-500 mt-1">Write, run, and submit code directly in the browser.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/workspace">
              <Terminal className="mr-2 h-4 w-4" /> Workspace
            </Link>
          </Button>
          {isStaff && (
            <Button asChild>
              <Link href="/admin/challenges">Manage Challenges</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {stats && !isStaff && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total", value: stats.total, icon: Code2, color: "text-gray-600" },
            { label: "Attempted", value: stats.attempted, icon: Zap, color: "text-blue-600" },
            { label: "Solved", value: stats.solved, icon: CheckCircle2, color: "text-green-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search challenges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="practice">Practice</SelectItem>
            <SelectItem value="assessment">Assessment</SelectItem>
            <SelectItem value="capstone">Capstone</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Challenge grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-gray-100">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-2/3" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((challenge) => (
            <Card
              key={challenge.id}
              className={`border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col group ${
                challenge.mySolved ? "ring-1 ring-green-200" : ""
              } ${isStaff && !challenge.isPublished ? "opacity-70 border-dashed" : ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`capitalize text-xs ${DIFFICULTY_COLORS[challenge.difficulty]}`}
                    >
                      {challenge.difficulty}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                      {TYPE_LABELS[challenge.type]}
                    </Badge>
                    {isStaff && !challenge.isPublished && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Draft</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-md shrink-0">
                    <span className="font-mono">{LANG_ICONS[challenge.language] ?? challenge.language}</span>
                  </div>
                </div>
                <CardTitle className="text-base font-display line-clamp-2 leading-snug">
                  {challenge.mySolved && (
                    <CheckCircle2 className="inline-block h-4 w-4 text-green-500 mr-1.5 -mt-0.5" />
                  )}
                  {challenge.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                <p className="text-sm text-gray-500 line-clamp-2">
                  {challenge.description}
                </p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    {challenge.points} pts
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {challenge.timeLimitMs / 1000}s limit
                  </span>
                  {(challenge.myAttempts ?? 0) > 0 && (
                    <span className="text-blue-600 font-medium">
                      {challenge.myAttempts} attempt{(challenge.myAttempts ?? 0) !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0 border-t border-gray-50">
                <Button variant="outline" className="w-full hover:bg-primary hover:text-white transition-colors" asChild>
                  <Link href={`/challenges/${challenge.id}`}>
                    {challenge.mySolved ? "View Solution" : "Solve Challenge"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Code2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No challenges found</h3>
          <p className="text-gray-500">
            {search || difficulty !== "all" || type !== "all"
              ? "Try adjusting your filters."
              : isStaff
                ? "Create the first challenge to get started."
                : "No coding challenges have been published yet."}
          </p>
        </div>
      )}
    </div>
  );
}
