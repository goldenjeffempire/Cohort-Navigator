import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Pin, CheckCircle, Search, Plus, Eye, ChevronDown } from "lucide-react";
import { useCommunities, useDiscussions } from "@/lib/community";

const CATEGORY_COLORS: Record<string, string> = {
  course: "bg-blue-100 text-blue-700 border-blue-200",
  lesson: "bg-indigo-100 text-indigo-700 border-indigo-200",
  assignment: "bg-amber-100 text-amber-700 border-amber-200",
  project: "bg-purple-100 text-purple-700 border-purple-200",
  ai: "bg-pink-100 text-pink-700 border-pink-200",
  general: "bg-slate-100 text-slate-600 border-slate-200",
  qna: "bg-teal-100 text-teal-700 border-teal-200",
};

function InitialsAvatar({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />;
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function DiscussionsList() {
  const [communityId, setCommunityId] = useState<number>(0);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [questionsOnly, setQuestionsOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  const { data: communities = [] } = useCommunities();
  const { data: threads = [], isLoading } = useDiscussions({
    communityId,
    category: category === "all" ? undefined : category,
    search: search || undefined,
    isQuestion: questionsOnly ? true : undefined,
    limit: PAGE_SIZE,
    offset,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discussions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Ask questions, share ideas, and learn together</p>
        </div>
        {communityId > 0 && (
          <Link href={`/discussions/new?communityId=${communityId}`}>
            <Button>
              <Plus className="h-4 w-4 mr-1.5" /> New Thread
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={communityId ? String(communityId) : ""}
          onValueChange={(v) => { setCommunityId(Number(v)); setOffset(0); }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select a community" />
          </SelectTrigger>
          <SelectContent>
            {(communities as any[]).map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={(v) => { setCategory(v); setOffset(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {["course", "lesson", "assignment", "project", "ai", "general", "qna"].map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search threads..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          />
        </div>

        <Button
          variant={questionsOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setQuestionsOnly(!questionsOnly); setOffset(0); }}
        >
          Q&A Only
        </Button>
      </div>

      {/* Thread list */}
      {!communityId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select a community to view discussions</p>
            <p className="text-sm mt-1">Choose a community from the dropdown above</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (threads as any[]).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No discussions found</p>
            <p className="text-sm mt-1">Be the first to start a conversation!</p>
            <Link href={`/discussions/new?communityId=${communityId}`}>
              <Button size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-1" /> New Thread
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {(threads as any[]).map((thread: any) => (
              <Card key={thread.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={thread.authorName} avatarUrl={thread.authorAvatarUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {thread.isPinned && (
                          <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        )}
                        <Link href={`/discussions/${thread.id}`}>
                          <span className="font-semibold hover:text-primary cursor-pointer leading-snug">
                            {thread.title}
                          </span>
                        </Link>
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[thread.category] ?? CATEGORY_COLORS.general}`}>
                          {thread.category}
                        </span>
                        {thread.isQuestion && !thread.isResolved && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-50 text-orange-600 border-orange-200 font-medium">
                            Q&A
                          </span>
                        )}
                        {thread.isResolved && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200 font-medium flex items-center gap-0.5">
                            <CheckCircle className="h-3 w-3" /> Resolved
                          </span>
                        )}
                        {thread.isLocked && (
                          <Badge variant="outline" className="text-xs">Locked</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-1.5">
                        {thread.body?.substring(0, 120)}{thread.body?.length > 120 ? "…" : ""}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/60">{thread.authorName}</span>
                        <span>{thread.postCount ?? 0} replies</span>
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" /> {thread.viewCount}
                        </span>
                        <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Showing {offset + 1}–{offset + (threads as any[]).length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(threads as any[]).length < PAGE_SIZE}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next <ChevronDown className="h-3 w-3 ml-1 rotate-[-90deg]" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
