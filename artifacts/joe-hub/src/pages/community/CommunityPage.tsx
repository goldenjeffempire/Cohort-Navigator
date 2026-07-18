import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Pin, CheckCircle, MessageSquare, Search, Plus, Globe, Shield } from "lucide-react";
import {
  useCommunity,
  useCommunityMembers,
  useDiscussions,
  useJoinCommunity,
  useLeaveCommunity,
} from "@/lib/community";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  course: "bg-blue-100 text-blue-700",
  lesson: "bg-indigo-100 text-indigo-700",
  assignment: "bg-amber-100 text-amber-700",
  project: "bg-purple-100 text-purple-700",
  ai: "bg-pink-100 text-pink-700",
  general: "bg-slate-100 text-slate-700",
  qna: "bg-teal-100 text-teal-700",
};

function InitialsAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function CommunityPage() {
  const [, params] = useRoute("/community/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [joined, setJoined] = useState<boolean | null>(null);

  const { data: community, isLoading: loadingCommunity } = useCommunity(id);
  const { data: members = [], isLoading: loadingMembers } = useCommunityMembers(id);
  const { data: threads = [], isLoading: loadingThreads } = useDiscussions({
    communityId: id,
    category: category === "all" ? undefined : category,
    search: search || undefined,
  });

  const joinMutation = useJoinCommunity();
  const leaveMutation = useLeaveCommunity();

  const handleJoin = () => {
    joinMutation.mutate(id, {
      onSuccess: () => {
        setJoined(true);
        toast({ title: "Joined community!" });
      },
    });
  };

  const handleLeave = () => {
    leaveMutation.mutate(id, {
      onSuccess: () => {
        setJoined(false);
        toast({ title: "Left community" });
      },
    });
  };

  if (loadingCommunity) {
    return <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-4" /></div>;
  }

  if (!community) {
    return <div className="p-6 text-muted-foreground">Community not found.</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            {(community as any).kind === "global" ? (
              <Globe className="h-6 w-6 text-primary" />
            ) : (
              <Users className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{(community as any).name}</h1>
            <p className="text-muted-foreground text-sm">
              {(community as any).memberCount ?? (members as any[]).length} members ·{" "}
              <Badge variant="outline" className="text-xs capitalize">
                {(community as any).kind}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {joined === true || joined === null ? (
            <Button variant="outline" size="sm" onClick={handleLeave} disabled={leaveMutation.isPending}>
              Leave
            </Button>
          ) : (
            <Button size="sm" onClick={handleJoin} disabled={joinMutation.isPending}>
              Join Community
            </Button>
          )}
        </div>
      </div>

      {(community as any).description && (
        <p className="text-muted-foreground">{(community as any).description}</p>
      )}

      {/* Tabs */}
      <Tabs defaultValue="discussions">
        <TabsList>
          <TabsTrigger value="discussions">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Discussions ({(threads as any[]).length})
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Members ({(members as any[]).length})
          </TabsTrigger>
          <TabsTrigger value="guidelines">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Guidelines
          </TabsTrigger>
        </TabsList>

        {/* Discussions Tab */}
        <TabsContent value="discussions" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search discussions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {["course", "lesson", "assignment", "project", "ai", "general", "qna"].map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href={`/discussions/new?communityId=${id}`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New Discussion
              </Button>
            </Link>
          </div>

          {loadingThreads ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (threads as any[]).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No discussions yet. Start the first one!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {(threads as any[]).map((thread: any) => (
                <Card key={thread.id} className="hover:border-primary/40 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <InitialsAvatar name={thread.authorName ?? "?"} avatarUrl={thread.authorAvatarUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {thread.isPinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
                          <Link href={`/discussions/${thread.id}`}>
                            <span className="font-medium hover:text-primary cursor-pointer line-clamp-1">
                              {thread.title}
                            </span>
                          </Link>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[thread.category] ?? "bg-slate-100 text-slate-700"}`}>
                            {thread.category}
                          </span>
                          {thread.isQuestion && !thread.isResolved && (
                            <Badge variant="outline" className="text-xs">Q&A</Badge>
                          )}
                          {thread.isResolved && (
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-0.5" /> Resolved
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{thread.authorName}</span>
                          <span>{thread.postCount ?? 0} replies</span>
                          <span>{thread.viewCount} views</span>
                          <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          {loadingMembers ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(members as any[]).map((m: any) => (
                <Card key={m.id} className="p-3 flex items-center gap-3">
                  <InitialsAvatar name={m.name} avatarUrl={m.avatarUrl} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <Badge variant="outline" className="text-xs capitalize mt-0.5">{m.role}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Guidelines Tab */}
        <TabsContent value="guidelines" className="mt-4">
          <Card>
            <CardContent className="py-6">
              {(community as any).guidelines ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-sans">
                  {(community as any).guidelines}
                </pre>
              ) : (
                <p className="text-muted-foreground text-center py-6">
                  No community guidelines have been set yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
