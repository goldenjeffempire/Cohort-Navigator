import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckSquare, Users, Link2, ArrowLeft, Plus, ChevronRight, Trash2,
} from "lucide-react";
import {
  useTeam, useTeamTasks, useCreateTask, useUpdateTask,
  useTeamResources, useAddResource,
} from "@/lib/community";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function InitialsAvatar({ name }: { name?: string }) {
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
const STATUS_LABELS: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const STATUS_COLORS: Record<string, string> = {
  todo: "border-slate-200 bg-slate-50",
  in_progress: "border-blue-200 bg-blue-50",
  done: "border-green-200 bg-green-50",
};

export default function TeamWorkspace() {
  const [, params] = useRoute("/teams/:id");
  const teamId = parseInt(params?.id ?? "0", 10);
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: team, isLoading: loadingTeam } = useTeam(teamId);
  const { data: tasks = [] } = useTeamTasks(teamId);
  const { data: resources = [] } = useTeamResources(teamId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const addResource = useAddResource();

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);

  // Resource form state
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resOpen, setResOpen] = useState(false);

  // Invite state
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteMutation = useMutation({
    mutationFn: ({ teamId, invitedUserId }: { teamId: number; invitedUserId: number }) =>
      customFetch(`/api/teams/${teamId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ invitedUserId }),
      }),
    onSuccess: () => {
      toast({ title: "Invitation sent!" });
      setInviteOpen(false);
      setInviteUserId("");
    },
    onError: () => toast({ title: "Failed to send invitation", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: number }) =>
      customFetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams", teamId] });
      toast({ title: "Member removed" });
    },
  });

  if (loadingTeam) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!team) return <div className="p-6 text-muted-foreground">Team not found.</div>;

  const t = team as any;
  const members: any[] = t.members ?? [];
  const myMembership = members.find((m: any) => m.userId !== undefined);
  const isLead = myMembership?.role === "lead" || (user?.publicMetadata as any)?.role === "admin";

  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = (tasks as any[]).filter((task: any) => task.status === status);
    return acc;
  }, {} as Record<string, any[]>);

  const advanceStatus = (task: any) => {
    const idx = TASK_STATUSES.indexOf(task.status);
    if (idx >= TASK_STATUSES.length - 1) return;
    const next = TASK_STATUSES[idx + 1];
    updateTask.mutate(
      { teamId, taskId: task.id, data: { status: next } },
      { onSuccess: () => toast({ title: `Task moved to ${STATUS_LABELS[next]}` }) },
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/teams">
          <Button variant="ghost" size="sm" className="-ml-1 mb-3">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Teams
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="capitalize text-xs">
                {t.kind?.replace("_", " ")}
              </Badge>
              <span className="text-sm text-muted-foreground">{members.length} members</span>
            </div>
          </div>
        </div>
        {t.description && <p className="text-muted-foreground mt-2">{t.description}</p>}
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks"><CheckSquare className="h-3.5 w-3.5 mr-1.5" />Tasks</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-3.5 w-3.5 mr-1.5" />Members</TabsTrigger>
          <TabsTrigger value="resources"><Link2 className="h-3.5 w-3.5 mr-1.5" />Resources</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>

        {/* ── Tasks ── */}
        <TabsContent value="tasks" className="mt-4">
          <div className="flex justify-end mb-3">
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Title *</Label>
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Optional description" />
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!taskTitle.trim()) return;
                    createTask.mutate(
                      { teamId, title: taskTitle.trim(), description: taskDesc || undefined },
                      { onSuccess: () => { setTaskOpen(false); setTaskTitle(""); setTaskDesc(""); toast({ title: "Task added!" }); } },
                    );
                  }} disabled={createTask.isPending}>
                    {createTask.isPending ? "Adding…" : "Add Task"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {TASK_STATUSES.map((status) => (
              <div key={status} className={`rounded-lg border-2 ${STATUS_COLORS[status]} p-3`}>
                <h3 className="text-sm font-semibold mb-3 text-foreground/70">{STATUS_LABELS[status]}</h3>
                <div className="space-y-2">
                  {tasksByStatus[status].map((task: any) => (
                    <Card key={task.id} className="shadow-none">
                      <CardContent className="py-2.5 px-3">
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                        )}
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                        {status !== "done" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-1.5 h-6 text-xs w-full"
                            onClick={() => advanceStatus(task)}
                          >
                            Move to {STATUS_LABELS[TASK_STATUSES[TASK_STATUSES.indexOf(status) + 1]]}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {tasksByStatus[status].length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-3">Empty</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Members ── */}
        <TabsContent value="members" className="mt-4 space-y-3">
          {isLead && (
            <div className="flex justify-end">
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Invite Member</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>User ID</Label>
                      <Input
                        type="number"
                        value={inviteUserId}
                        onChange={(e) => setInviteUserId(e.target.value)}
                        placeholder="Enter user ID"
                      />
                    </div>
                    <Button className="w-full" onClick={() => {
                      const uid = parseInt(inviteUserId, 10);
                      if (Number.isNaN(uid)) return;
                      inviteMutation.mutate({ teamId, invitedUserId: uid });
                    }} disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? "Sending…" : "Send Invitation"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <InitialsAvatar name={m.userName} />
                <div>
                  <p className="text-sm font-medium">{m.userName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={m.role === "lead" ? "default" : "outline"} className="text-xs capitalize">
                      {m.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(m.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              {isLead && m.role !== "lead" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeMemberMutation.mutate({ teamId, userId: m.userId })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        {/* ── Resources ── */}
        <TabsContent value="resources" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={resOpen} onOpenChange={setResOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Resource</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Title *</Label>
                    <Input value={resTitle} onChange={(e) => setResTitle(e.target.value)} placeholder="Resource name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>URL</Label>
                    <Input value={resUrl} onChange={(e) => setResUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!resTitle.trim()) return;
                    addResource.mutate(
                      { teamId, title: resTitle.trim(), url: resUrl || undefined },
                      { onSuccess: () => { setResOpen(false); setResTitle(""); setResUrl(""); toast({ title: "Resource added!" }); } },
                    );
                  }} disabled={addResource.isPending}>
                    {addResource.isPending ? "Adding…" : "Add Resource"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {(resources as any[]).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Link2 className="h-7 w-7 mx-auto mb-2 opacity-30" />
              <p>No resources yet. Add links or files to share with the team.</p>
            </CardContent></Card>
          ) : (
            (resources as any[]).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary underline break-all">
                      {r.url}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Added {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ── Discussion ── */}
        <TabsContent value="discussion" className="mt-4">
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground mb-4">Team discussions are in the community forum.</p>
              <Link href={`/discussions?teamId=${teamId}`}>
                <Button variant="outline">View Team Discussions</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
