/**
 * Admin AI Dashboard — model management, knowledge base, analytics, and audit logs.
 */
import { useState } from "react";
import {
  useAIAdminStatus, useAIAdminAnalytics, useAIAdminModels, useAIAdminPrompts,
  useAIAdminAudit, useKnowledgeStats, useSyncKnowledge,
} from "@/lib/ai";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { aiKeys } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Server, Database, Zap, Activity,
  MessageSquare, Flag, Star, RefreshCw, Loader2, Plus, Shield, BarChart3,
} from "lucide-react";

function StatusBadge({ online }: { online: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {online ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {online ? "Online" : "Offline"}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-primary" }: { label: string; value: string | number; icon: typeof Server; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="text-2xl font-display font-bold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminAI() {
  const { data: status } = useAIAdminStatus();
  const { data: analytics } = useAIAdminAnalytics();
  const { data: models } = useAIAdminModels();
  const { data: prompts } = useAIAdminPrompts();
  const { data: auditLogs } = useAIAdminAudit();
  const { data: knowledgeStats } = useKnowledgeStats();
  const syncMutation = useSyncKnowledge();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newModel, setNewModel] = useState({ name: "", displayName: "", modelId: "", endpoint: "", provider: "ollama" });
  const [addingModel, setAddingModel] = useState(false);

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      toast({ title: "Knowledge Base Synced", description: result.message });
      qc.invalidateQueries({ queryKey: aiKeys.knowledgeStats() });
    } catch {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
  };

  const handleAddModel = async () => {
    if (!newModel.name || !newModel.modelId) return;
    setAddingModel(true);
    try {
      await customFetch("/api/ai/admin/models", { method: "POST", body: JSON.stringify(newModel) });
      qc.invalidateQueries({ queryKey: aiKeys.adminModels() });
      setNewModel({ name: "", displayName: "", modelId: "", endpoint: "", provider: "ollama" });
      toast({ title: "Model registered" });
    } catch {
      toast({ title: "Failed to register model", variant: "destructive" });
    }
    setAddingModel(false);
  };

  const activateModel = async (id: number) => {
    await customFetch(`/api/ai/admin/models/${id}/activate`, { method: "POST" });
    qc.invalidateQueries({ queryKey: aiKeys.adminModels() });
    toast({ title: "Model activated" });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">AI Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the JOE Forge AI platform</p>
        </div>
        {status && (
          <div className="flex items-center gap-3">
            <StatusBadge online={status.localOnline} />
            <Badge variant="outline" className="text-xs">
              {status.mode === "local_model" ? "🤖 Local Model" : "🔍 RAG Engine"}
            </Badge>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="models"><Server className="h-3.5 w-3.5 mr-1" />Models</TabsTrigger>
          <TabsTrigger value="knowledge"><Database className="h-3.5 w-3.5 mr-1" />Knowledge</TabsTrigger>
          <TabsTrigger value="prompts"><Zap className="h-3.5 w-3.5 mr-1" />Prompts</TabsTrigger>
          <TabsTrigger value="audit"><Shield className="h-3.5 w-3.5 mr-1" />Audit</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Conversations" value={analytics?.totalConversations ?? "—"} icon={MessageSquare} />
            <StatCard label="Total Messages" value={analytics?.totalMessages ?? "—"} icon={Activity} />
            <StatCard label="Flagged Requests" value={analytics?.flaggedRequests ?? 0} icon={Flag} color="text-amber-500" />
            <StatCard label="Avg Rating" value={analytics?.averageRating ?? "—"} icon={Star} color="text-yellow-500" />
          </div>

          {/* Conversations by mode */}
          {analytics?.conversationsByMode && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Conversations by Mode</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(analytics.conversationsByMode).map(([mode, count]) => (
                    <div key={mode} className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-gray-900">{String(count)}</div>
                      <div className="text-xs text-gray-400 capitalize">{mode}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Engine status */}
          {status && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Engine Status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Inference Mode</span><span className="font-medium capitalize">{status.mode.replace("_", " ")}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Local Model Server</span><StatusBadge online={status.localOnline} /></div>
                <div className="flex justify-between"><span className="text-gray-500">Model Endpoint</span><span className="text-xs font-mono text-gray-600">{status.localModelEndpoint ?? "Not configured"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Registered Models</span><span className="font-medium">{status.registry.models}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Platform Version</span><span className="font-mono text-xs">{status.version}</span></div>
              </CardContent>
            </Card>
          )}

          {/* Setup guidance */}
          {!status?.localOnline && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              <div className="font-medium mb-1">🚀 Upgrade to Local LLM</div>
              <p className="text-xs text-blue-600">Set the <code className="bg-blue-100 px-1 rounded">AI_MODEL_ENDPOINT</code> environment variable to point to an Ollama or vLLM server to enable full language model inference. Current mode uses the built-in RAG engine.</p>
              <div className="mt-2 text-xs font-mono text-blue-700">AI_MODEL_ENDPOINT=http://localhost:11434</div>
            </div>
          )}
        </TabsContent>

        {/* Models */}
        <TabsContent value="models" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Register a Model</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input value={newModel.name} onChange={(e) => setNewModel((p) => ({ ...p, name: e.target.value }))} placeholder="Identifier (e.g. llama3-8b)" className="h-9 text-sm" />
                <Input value={newModel.displayName} onChange={(e) => setNewModel((p) => ({ ...p, displayName: e.target.value }))} placeholder="Display Name" className="h-9 text-sm" />
                <Input value={newModel.modelId} onChange={(e) => setNewModel((p) => ({ ...p, modelId: e.target.value }))} placeholder="Model ID (e.g. llama3.2:8b)" className="h-9 text-sm" />
                <Input value={newModel.endpoint} onChange={(e) => setNewModel((p) => ({ ...p, endpoint: e.target.value }))} placeholder="Endpoint URL (optional override)" className="h-9 text-sm" />
              </div>
              <Button size="sm" onClick={handleAddModel} disabled={addingModel || !newModel.name || !newModel.modelId}>
                {addingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Register Model
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {models?.map((model: any) => (
              <Card key={model.id} className={model.isDefault ? "border-primary/30" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Server className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {model.displayName}
                      {model.isDefault && <Badge className="text-[10px] py-0">Active</Badge>}
                      <Badge variant="outline" className="text-[10px] py-0">{model.status}</Badge>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{model.modelId} • {model.provider}</div>
                    {model.endpoint && <div className="text-xs text-gray-400">{model.endpoint}</div>}
                  </div>
                  {!model.isDefault && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => activateModel(model.id)}>Set Active</Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {(!models || models.length === 0) && (
              <div className="text-center py-8 text-gray-400 text-sm">No models registered. The built-in RAG engine is active.</div>
            )}
          </div>
        </TabsContent>

        {/* Knowledge Base */}
        <TabsContent value="knowledge" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Knowledge Index</CardTitle>
                <Button size="sm" onClick={handleSync} disabled={syncMutation.isPending}>
                  {syncMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Sync All Content
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Chunks</span>
                <span className="text-lg font-bold text-gray-900">{knowledgeStats?.totalChunks ?? 0}</span>
              </div>
              {knowledgeStats?.bySource && Object.keys(knowledgeStats.bySource).length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(knowledgeStats.bySource).map(([src, cnt]) => (
                    <div key={src} className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-gray-900">{String(cnt)}</div>
                      <div className="text-xs text-gray-400 capitalize">{src}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-400 pt-1">
                Sync indexes all lessons and challenges into the knowledge base for RAG retrieval. Run after adding new course content.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts */}
        <TabsContent value="prompts" className="space-y-4 mt-4">
          <div className="space-y-2">
            {prompts?.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{p.name}</span>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-xs capitalize">{p.mode}</Badge>
                      <Badge variant="outline" className={`text-xs ${p.isActive ? "text-green-600" : "text-gray-400"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                </CardContent>
              </Card>
            ))}
            {(!prompts || prompts.length === 0) && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No custom prompts. Built-in prompts are active for all modes.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit" className="space-y-3 mt-4">
          <div className="space-y-1.5">
            {auditLogs?.map((log: any) => (
              <div key={log.id} className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs ${log.responseStatus === "blocked" ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
                <Shield className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${log.responseStatus === "blocked" ? "text-red-500" : "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium capitalize">{log.event.replace(/_/g, " ")}</span>
                    <Badge variant="outline" className={`text-[10px] py-0 ${log.responseStatus === "blocked" ? "border-red-300 text-red-600" : ""}`}>{log.responseStatus}</Badge>
                    {log.flagReason && <Badge variant="outline" className="text-[10px] py-0 border-amber-300 text-amber-600">{log.flagReason}</Badge>}
                  </div>
                  {log.requestSummary && <div className="text-gray-500 truncate">{log.requestSummary}</div>}
                </div>
                <span className="text-gray-400 shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
            {(!auditLogs || auditLogs.length === 0) && (
              <div className="text-center py-8 text-gray-400 text-sm">No audit events yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
