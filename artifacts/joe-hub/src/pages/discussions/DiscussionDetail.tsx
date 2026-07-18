import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pin, CheckCircle, Eye, ArrowLeft, Trash2, Lock } from "lucide-react";
import { useDiscussion, useDiscussionPosts, useCreatePost, useReactToThread, useDeleteDiscussion } from "@/lib/community";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const CATEGORY_COLORS: Record<string, string> = {
  course: "bg-blue-100 text-blue-700",
  lesson: "bg-indigo-100 text-indigo-700",
  assignment: "bg-amber-100 text-amber-700",
  project: "bg-purple-100 text-purple-700",
  ai: "bg-pink-100 text-pink-700",
  general: "bg-slate-100 text-slate-600",
  qna: "bg-teal-100 text-teal-700",
};

const EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "🔥"];

function InitialsAvatar({ name, avatarUrl, size = "md" }: { name?: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sz} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function DiscussionDetail() {
  const [, params] = useRoute("/discussions/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: thread, isLoading: loadingThread } = useDiscussion(id);
  const { data: posts = [], isLoading: loadingPosts } = useDiscussionPosts(id);
  const createPost = useCreatePost(id);
  const reactMutation = useReactToThread();
  const deleteMutation = useDeleteDiscussion();

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    createPost.mutate(
      { body: replyBody },
      {
        onSuccess: () => {
          setReplyBody("");
          toast({ title: "Reply posted!" });
        },
        onError: () => toast({ title: "Failed to post reply", variant: "destructive" }),
        onSettled: () => setSubmitting(false),
      },
    );
  };

  const handleReact = (emoji: string) => {
    reactMutation.mutate(
      { threadId: id, emoji },
      { onError: () => toast({ title: "Reaction failed", variant: "destructive" }) },
    );
  };

  const handleDelete = () => {
    if (!confirm("Delete this discussion?")) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Discussion deleted" });
        setLocation("/discussions");
      },
    });
  };

  if (loadingThread) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="h-6 bg-muted rounded w-32 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!thread) {
    return <div className="p-6 text-muted-foreground">Discussion not found.</div>;
  }

  const t = thread as any;
  const isAuthor = user?.id && t.authorId !== undefined;
  const isResolved = t.isResolved;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/discussions">
        <Button variant="ghost" size="sm" className="-ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discussions
        </Button>
      </Link>

      {/* Thread header */}
      <Card>
        <CardHeader className="pb-3">
          {/* Banners */}
          {t.isPinned && (
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/20 rounded px-2.5 py-1.5 mb-3">
              <Pin className="h-3 w-3" /> Pinned discussion
            </div>
          )}
          {isResolved && (
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2.5 py-1.5 mb-3">
              <CheckCircle className="h-3 w-3" /> This question has been resolved
            </div>
          )}
          {t.isLocked && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border rounded px-2.5 py-1.5 mb-3">
              <Lock className="h-3 w-3" /> This thread is locked
            </div>
          )}

          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-tight">{t.title}</h1>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.general}`}>
              {t.category}
            </span>
            {t.isQuestion && <Badge variant="outline" className="text-xs">Q&A</Badge>}
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {t.viewCount} views
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Author */}
          <div className="flex items-center gap-2">
            <InitialsAvatar name={t.authorName} avatarUrl={t.authorAvatarUrl} />
            <span className="text-sm font-medium">{t.authorName}</span>
          </div>

          {/* Body */}
          <div className="prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground bg-muted/30 rounded-lg p-4">
              {t.body}
            </pre>
          </div>

          {/* Emoji reactions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="text-lg hover:scale-110 transition-transform px-1"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Posts / Replies */}
      <div>
        <h2 className="text-base font-semibold mb-3">
          {(posts as any[]).length} {(posts as any[]).length === 1 ? "Reply" : "Replies"}
        </h2>

        {loadingPosts ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}
          </div>
        ) : (posts as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No replies yet. Be the first to reply!</p>
        ) : (
          <div className="space-y-3">
            {(posts as any[]).filter((p: any) => !p.isDeleted).map((post: any) => (
              <Card
                key={post.id}
                className={`ml-${post.parentPostId ? "8" : "0"} ${t.acceptedPostId === post.id ? "border-green-400 bg-green-50/30" : ""}`}
              >
                <CardContent className="py-3 px-4">
                  {t.acceptedPostId === post.id && (
                    <div className="flex items-center gap-1 text-xs text-green-700 mb-2">
                      <CheckCircle className="h-3.5 w-3.5" /> Accepted Answer
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={post.authorName} avatarUrl={post.authorAvatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{post.authorName}</span>
                        <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm font-sans text-foreground/90 leading-relaxed">
                        {post.body}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reply composer */}
      {!t.isLocked && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Write a Reply</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Write your reply in Markdown..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end">
              <Button onClick={handleReply} disabled={!replyBody.trim() || submitting}>
                {submitting ? "Posting…" : "Post Reply"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
