/**
 * Admin AI Management Dashboard
 *
 * Sections:
 * - Engine status (mode, latency, version)
 * - Model registry (list, activate, evaluate)
 * - Cache stats
 * - Platform analytics (conversations, ratings, flagged)
 * - Knowledge base (stats, sync, search)
 * - At-risk students (from learning profiles)
 * - Audit log
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Brain, Server, Shield, Database, Users, AlertTriangle,
  CheckCircle2, XCircle, Play, Zap, RefreshCw, Activity,
  BarChart3, MessageSquare, Star, Search, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  useAIAdminStatus, useAIAdminModels, useAIAdminAnalytics, useAIAdminAudit,
} from "@/lib/ai";

// ─── Section: Engine Status ────────────────────────────────────────────────────

function EngineStatusSection() {
  const { data: status, isLoading, refetch } = useAIAdminStatus();

  if (isLoading) return <Card className="p-6 animate-pulse"><div className="h-20 bg-muted rounded" /></Card>;

  const online = status?.localOnline;
  const cache = status?.cacheStats;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" /> Engine Status
          </CardTitle>
          <CardDescription>Version {status?.version ?? "—"}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {online ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <XCircle className="h-5 w-5 text-amber-500" />
          )}
          <div>
            <p className="font-semibold">
              {status?.mode === "local_model" ? "Local LLM (Ollama)" : "Built-in RAG Engine"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status?.localModelEndpoint ?? "No external endpoint configured — using built-in RAG"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Models", value: status?.registry?.models ?? 0 },
            { label: "Conversations", value: status?.usage?.conversations ?? 0 },
            { label: "Messages", value: status?.usage?.messages ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {cache && (
          <div>
            <p className="text-sm font-medium mb-2">Response Cache</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/30 rounded p-2">
                <p className="text-muted-foreground">Hit Rate</p>
                <p className="font-bold text-base">{cache.response.hitRate}%</p>
              </div>
              <div className="bg-muted/30 rounded p-2">
                <p className="text-muted-foreground">Cached Entries</p>
                <p className="font-bold text-base">{cache.response.size} / 500</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Model Registry ───────────────────────────────────────────────────

function ModelRegistrySection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: models, isLoading } = useAIAdminModels();

  const activateMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/ai/admin/models/${id}/activate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-admin-models"] }); toast({ title: "Model activated" }); },
    onError: () => toast({ title: "Activation failed", variant: "destructive" }),
  });

  const evalMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/ai/admin/models/${id}/evaluate`, { method: "POST" }),
    onSuccess: (data: any) => toast({ title: `Eval complete: ${data.casesPassed}/${data.casesRun} passed (${data.score?.toFixed(0)}%)` }),
    onError: () => toast({ title: "Evaluation failed", variant: "destructive" }),
  });

  if (isLoading) return <Card className="p-6 animate-pulse"><div className="h-32 bg-muted rounded" /></Card>;

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-600",
    testing: "bg-blue-100 text-blue-800",
    deprecated: "bg-red-100 text-red-600",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Model Registry</CardTitle>
        <CardDescription>Registered AI model configurations</CardDescription>
      </CardHeader>
      <CardContent>
        {!models || models.length === 0 ? (
          <p className="text-sm text-muted-foreground">No models registered. Use the API to add Ollama model configurations.</p>
        ) : (
          <div className="space-y-3">
            {models.map((model: any) => (
              <div key={model.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{model.displayName}</p>
                      {model.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${STATUS_COLORS[model.status] ?? ""}`}>
                        {model.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{model.modelId} · {model.provider}</p>
                    <p className="text-xs text-muted-foreground">{model.contextWindow.toLocaleString()} ctx · {model.capabilities}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!model.isDefault && (
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => activateMutation.mutate(model.id)}
                        disabled={activateMutation.isPending}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Activate
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => evalMutation.mutate(model.id)}
                      disabled={evalMutation.isPending}>
                      <Play className="h-3 w-3 mr-1" />
                      {evalMutation.isPending ? "Running…" : "Evaluate"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Platform Analytics ───────────────────────────────────────────────

function PlatformAnalyticsSection() {
  const { data, isLoading } = useAIAdminAnalytics();

  if (isLoading) return <Card className="p-6 animate-pulse"><div className="h-40 bg-muted rounded" /></Card>;

  const overview = data?.overview ?? {};
  const weekData = data?.last7Days ?? {};
  const profileData = data?.learningProfiles ?? {};
  const riskBreakdown = profileData.riskBreakdown ?? {};

  const topModes = (weekData.byMode ?? []).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Platform Analytics</CardTitle>
        <CardDescription>AI usage across all students</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Conversations", value: overview.totalAIConversations ?? 0, icon: MessageSquare },
            { label: "Total Messages", value: overview.totalAIMessages ?? 0, icon: Activity },
            { label: "Avg Rating", value: overview.avgMessageRating ? `${overview.avgMessageRating}/5` : "—", icon: Star },
            { label: "Feedback Items", value: overview.totalFeedback ?? 0, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
              <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {topModes.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Top AI Modes (last 7 days)</p>
            <div className="space-y-1.5">
              {topModes.map(({ mode, count }: { mode: string; count: number }) => {
                const max = topModes[0].count;
                return (
                  <div key={mode} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-right text-muted-foreground capitalize">{mode}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-8 text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        <div>
          <p className="text-sm font-medium mb-2">Student Risk Levels</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(riskBreakdown).map(([level, count]) => (
              <div key={level} className="flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1">
                <div className={`h-2 w-2 rounded-full ${
                  level === "high" ? "bg-red-500" : level === "medium" ? "bg-amber-500" :
                  level === "low" ? "bg-yellow-500" : "bg-green-500"
                }`} />
                <span className="text-xs capitalize">{level}</span>
                <span className="text-xs font-bold">{String(count)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Avg competency: <strong>{profileData.avgCompetencyScore ?? 0}/100</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section: Knowledge Base ───────────────────────────────────────────────────

function KnowledgeBaseSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["ai-knowledge-stats"],
    queryFn: () => customFetch<{ totalChunks: number; bySource: Record<string, number> }>("/api/ai/knowledge/stats"),
  });

  const syncMutation = useMutation({
    mutationFn: () => customFetch<{ indexed: number; message: string }>("/api/ai/knowledge/sync", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: `Sync complete: ${data.indexed} chunks indexed` });
      qc.invalidateQueries({ queryKey: ["ai-knowledge-stats"] });
    },
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const searchMutation = useMutation({
    mutationFn: (q: string) =>
      customFetch<any[]>(`/api/ai/knowledge/search?q=${encodeURIComponent(q)}&limit=5`),
    onSuccess: (data) => setSearchResults(data),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> Knowledge Base</CardTitle>
          <CardDescription>
            {statsLoading ? "Loading…" : `${stats?.totalChunks ?? 0} indexed chunks`}
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing…" : "Sync Content"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.bySource).map(([source, count]) => (
              <div key={source} className="bg-muted/40 text-xs rounded px-2 py-1 capitalize">
                {source}: <strong>{count}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Test semantic search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate(searchQuery)}
          />
          <Button size="sm" variant="outline" onClick={() => searchMutation.mutate(searchQuery)} disabled={!searchQuery}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((r) => (
              <div key={r.id} className="border rounded p-2 text-xs">
                <div className="flex justify-between mb-0.5">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-muted-foreground">score: {r.score?.toFixed(3)}</span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: At-Risk Students ─────────────────────────────────────────────────

function AtRiskSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-at-risk-students"],
    queryFn: () => customFetch<{ atRiskStudents: any[]; total: number }>("/api/ai/learning/at-risk"),
  });

  if (isLoading) return <Card className="p-4 animate-pulse"><div className="h-20 bg-muted rounded" /></Card>;

  const students = data?.atRiskStudents ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          At-Risk Students
          {students.length > 0 && <Badge variant="destructive">{students.length}</Badge>}
        </CardTitle>
        <CardDescription>Students with medium or high risk levels based on their learning profile</CardDescription>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No at-risk students detected.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.slice(0, 10).map((s) => (
              <div key={s.userId} className="flex items-center justify-between border rounded p-2">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${s.riskLevel === "high" ? "bg-red-500" : "bg-amber-500"}`} />
                  <div>
                    <p className="text-sm font-medium">Student #{s.userId}</p>
                    <p className="text-xs text-muted-foreground">
                      Competency: {Math.round(s.competencyScore)}/100 · Velocity: {s.learningVelocity?.toFixed(1)}/wk
                    </p>
                  </div>
                </div>
                <Badge variant={s.riskLevel === "high" ? "destructive" : "secondary"} className="capitalize shrink-0">
                  {s.riskLevel}
                </Badge>
              </div>
            ))}
            {students.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">+{students.length - 10} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Audit Log ────────────────────────────────────────────────────────

function AuditLogSection() {
  const { data: audit, isLoading } = useAIAdminAudit();

  const eventColors: Record<string, string> = {
    content_flagged: "text-red-600",
    prompt_injection_detected: "text-red-600",
    rate_limit_hit: "text-amber-600",
    model_switch: "text-blue-600",
    feedback_submitted: "text-green-600",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Audit Log</CardTitle>
        <CardDescription>Security and usage events (last 50)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
        ) : !audit || audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {audit.map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b last:border-0">
                <span className="text-muted-foreground w-20 shrink-0">{new Date(log.createdAt).toLocaleDateString()}</span>
                <span className={`font-medium shrink-0 ${eventColors[log.event] ?? "text-foreground"}`}>
                  {log.event.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground truncate">{log.requestSummary ?? ""}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAI() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> AI Platform Management
        </h1>
        <p className="text-sm text-muted-foreground">Native AI ecosystem — no third-party APIs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EngineStatusSection />
        <ModelRegistrySection />
      </div>

      <PlatformAnalyticsSection />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KnowledgeBaseSection />
        <AtRiskSection />
      </div>

      <AuditLogSection />
    </div>
  );
}
