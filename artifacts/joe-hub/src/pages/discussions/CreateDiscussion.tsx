import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useCommunities, useCreateDiscussion } from "@/lib/community";
import { useToast } from "@/hooks/use-toast";

export default function CreateDiscussion() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: communities = [] } = useCommunities();

  // Pull communityId from query params
  const params = new URLSearchParams(window.location.search);
  const defaultCommunityId = params.get("communityId") ?? "";

  const [communityId, setCommunityId] = useState(defaultCommunityId);
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createMutation = useCreateDiscussion();

  const handleSubmit = () => {
    if (!communityId || !title.trim() || !body.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    createMutation.mutate(
      {
        communityId: Number(communityId),
        category,
        title: title.trim(),
        body: body.trim(),
        isQuestion,
      },
      {
        onSuccess: (thread: any) => {
          toast({ title: "Discussion created!" });
          setLocation(`/discussions/${thread.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create discussion", variant: "destructive" });
          setSubmitting(false);
        },
      },
    );
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/discussions">
          <Button variant="ghost" size="sm" className="-ml-1 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New Discussion</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Start a conversation with your community</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Community */}
          <div className="space-y-1.5">
            <Label>Community *</Label>
            <Select value={communityId} onValueChange={setCommunityId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a community" />
              </SelectTrigger>
              <SelectContent>
                {(communities as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["general", "course", "lesson", "assignment", "project", "ai", "qna"].map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              placeholder="What's the topic of this discussion?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{title.length}/200</p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label>Body *</Label>
            <Textarea
              placeholder="Write your post in Markdown... Code blocks use ```language ... ``` syntax."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Markdown supported. Use ```language for code blocks.</p>
          </div>

          {/* Q&A toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isQuestion}
              onChange={(e) => setIsQuestion(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <span className="text-sm font-medium">Post as a Question (Q&A)</span>
              <p className="text-xs text-muted-foreground">Marks this as a question. The best answer can be marked as accepted.</p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={submitting || !communityId || !title.trim() || !body.trim()}>
              {submitting ? "Posting…" : "Post Discussion"}
            </Button>
            <Link href="/discussions">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
