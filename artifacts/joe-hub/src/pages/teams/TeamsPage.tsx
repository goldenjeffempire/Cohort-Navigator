import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, ArrowRight, Check, X, FolderOpen, BookOpen } from "lucide-react";
import {
  useTeams, useCreateTeam, useMyInvitations, useAcceptInvitation, useDeclineInvitation,
} from "@/lib/community";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

function TeamCard({ team }: { team: any }) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {team.kind === "project" ? (
                <FolderOpen className="h-5 w-5 text-primary" />
              ) : (
                <BookOpen className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">{team.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs capitalize">
                  {team.kind.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {team.memberCount ?? 0} members
                </span>
              </div>
            </div>
          </div>
          <Link href={`/teams/${team.id}`}>
            <Button size="sm" variant="outline">
              Open <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {team.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{team.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CreateTeamDialog({ onCreated }: { onCreated?: () => void }) {
  const { toast } = useToast();
  const { data: cohorts = [] } = useQuery<any[]>({
    queryKey: ["cohorts"],
    queryFn: () => customFetch("/api/cohorts"),
  });
  const createTeam = useCreateTeam();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("project");
  const [cohortId, setCohortId] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !cohortId) {
      toast({ title: "Name and cohort are required", variant: "destructive" });
      return;
    }
    createTeam.mutate(
      { name: name.trim(), description: description || undefined, kind, cohortId: Number(cohortId) },
      {
        onSuccess: () => {
          toast({ title: "Team created!" });
          setOpen(false);
          setName(""); setDescription(""); setCohortId(""); setKind("project");
          onCreated?.();
        },
        onError: () => toast({ title: "Failed to create team", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a Team</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="What's this team about?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Project Team</SelectItem>
                <SelectItem value="study_group">Study Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cohort *</Label>
            <Select value={cohortId} onValueChange={setCohortId}>
              <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
              <SelectContent>
                {(cohorts as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={createTeam.isPending}>
            {createTeam.isPending ? "Creating…" : "Create Team"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsPage() {
  const { toast } = useToast();
  const { data: myTeams = [], isLoading: loadingMine } = useTeams({ mine: true });
  const { data: allTeams = [], isLoading: loadingAll } = useTeams();
  const { data: studyGroups = [] } = useTeams({ kind: "study_group" });
  const { data: invitations = [], isLoading: loadingInvitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  const pendingCount = (invitations as any[]).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Collaborate on projects and study together</p>
        </div>
        <CreateTeamDialog />
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My Teams ({(myTeams as any[]).length})</TabsTrigger>
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="study">Study Groups</TabsTrigger>
          <TabsTrigger value="invitations" className="relative">
            Invitations
            {pendingCount > 0 && (
              <span className="ml-1.5 h-4 w-4 bg-primary rounded-full text-[9px] text-primary-foreground flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* My Teams */}
        <TabsContent value="mine" className="mt-4 space-y-3">
          {loadingMine ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded animate-pulse" />)}</div>
          ) : (myTeams as any[]).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>You're not in any teams yet.</p>
            </CardContent></Card>
          ) : (
            (myTeams as any[]).map((t: any) => <TeamCard key={t.id} team={t} />)
          )}
        </TabsContent>

        {/* All Teams */}
        <TabsContent value="all" className="mt-4 space-y-3">
          {loadingAll ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            (allTeams as any[]).map((t: any) => <TeamCard key={t.id} team={t} />)
          )}
        </TabsContent>

        {/* Study Groups */}
        <TabsContent value="study" className="mt-4 space-y-3">
          {(studyGroups as any[]).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No study groups yet.</p>
            </CardContent></Card>
          ) : (
            (studyGroups as any[]).map((t: any) => <TeamCard key={t.id} team={t} />)
          )}
        </TabsContent>

        {/* Invitations */}
        <TabsContent value="invitations" className="mt-4 space-y-3">
          {loadingInvitations ? (
            <div className="h-24 bg-muted rounded animate-pulse" />
          ) : (invitations as any[]).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <p>No pending invitations.</p>
            </CardContent></Card>
          ) : (
            (invitations as any[]).map((inv: any) => (
              <Card key={inv.id}>
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{inv.teamName}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited by {inv.inviterName} · <Badge variant="outline" className="text-xs capitalize">{inv.teamKind?.replace("_", " ")}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptInvitation.mutate(inv.id, {
                        onSuccess: () => toast({ title: "Joined team!" }),
                        onError: () => toast({ title: "Failed to accept", variant: "destructive" }),
                      })}
                      disabled={acceptInvitation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => declineInvitation.mutate(inv.id, {
                        onSuccess: () => toast({ title: "Invitation declined" }),
                      })}
                      disabled={declineInvitation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
