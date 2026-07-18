import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, Calendar, Clock, CheckCircle, XCircle, Star } from "lucide-react";
import {
  useMentors, useMyMentoringSessions, useUpdateSession, useSubmitFeedback,
} from "@/lib/community";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-slate-100 text-slate-600",
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`text-xl ${n <= value ? "text-yellow-400" : "text-muted-foreground/30"} hover:text-yellow-400 transition-colors`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function InitialsAvatar({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />;
  return (
    <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function MentorDirectory() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [feedbackSession, setFeedbackSession] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: mentors = [], isLoading: loadingMentors } = useMentors();
  const { data: sessions = [], isLoading: loadingSessions } = useMyMentoringSessions();
  const updateSession = useUpdateSession();
  const submitFeedback = useSubmitFeedback();

  const filtered = (mentors as any[]).filter((m: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.headline?.toLowerCase().includes(q) ||
      m.expertise?.toLowerCase().includes(q)
    );
  });

  const handleCancel = (sessionId: number) => {
    if (!confirm("Cancel this session?")) return;
    updateSession.mutate(
      { id: sessionId, data: { status: "cancelled" } },
      {
        onSuccess: () => toast({ title: "Session cancelled" }),
        onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
      },
    );
  };

  const handleFeedbackSubmit = () => {
    if (!feedbackSession) return;
    submitFeedback.mutate(
      {
        sessionId: feedbackSession.id,
        rating,
        comment: comment || undefined,
        authorRole: "student",
      },
      {
        onSuccess: () => {
          toast({ title: "Feedback submitted!" });
          setFeedbackSession(null);
          setRating(5);
          setComment("");
        },
        onError: () => toast({ title: "Failed to submit feedback", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mentorship</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Connect with mentors, book sessions, and grow your career</p>
      </div>

      <Tabs defaultValue="mentors">
        <TabsList>
          <TabsTrigger value="mentors">Find a Mentor</TabsTrigger>
          <TabsTrigger value="sessions">My Sessions</TabsTrigger>
        </TabsList>

        {/* ── Mentor Directory ── */}
        <TabsContent value="mentors" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, expertise, or headline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loadingMentors ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No mentors found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((mentor: any) => (
                <Card key={mentor.userId} className="hover:border-primary/40 transition-colors">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-4">
                      <InitialsAvatar name={mentor.name} avatarUrl={mentor.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{mentor.name ?? `Mentor #${mentor.userId}`}</h3>
                        {mentor.headline && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{mentor.headline}</p>
                        )}
                        {mentor.expertise && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {mentor.expertise.split(",").map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag.trim()}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          {mentor.isAcceptingBookings ? (
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-0.5" /> Accepting bookings
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Not accepting
                            </Badge>
                          )}
                        </div>
                        <Link href={`/mentorship/${mentor.userId}`}>
                          <Button size="sm" className="mt-3" disabled={!mentor.isAcceptingBookings}>
                            View Profile & Book
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── My Sessions ── */}
        <TabsContent value="sessions" className="space-y-4 mt-4">
          {loadingSessions ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (sessions as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No sessions yet. Book your first mentor session!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(sessions as any[]).map((session: any) => (
                <Card key={session.id}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-semibold">{session.mentorName ?? `Mentor #${session.mentorId}`}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[session.status]}`}>
                            {session.status}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {session.format.replace("_", "-")}
                          </Badge>
                        </div>
                        {session.topic && (
                          <p className="text-sm text-muted-foreground mb-1">Topic: {session.topic}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.startsAt).toLocaleString()}
                          </span>
                          <span>–</span>
                          <span>{new Date(session.endsAt).toLocaleTimeString()}</span>
                        </div>
                        {session.meetingLink && session.status === "scheduled" && (
                          <a
                            href={session.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline mt-1 block"
                          >
                            Join meeting
                          </a>
                        )}
                        {session.recordingUrl && (
                          <a
                            href={session.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline mt-1 block"
                          >
                            View recording
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {session.status === "scheduled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(session.id)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            Cancel
                          </Button>
                        )}
                        {session.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setFeedbackSession(session); setRating(5); setComment(""); }}
                          >
                            <Star className="h-3.5 w-3.5 mr-1" /> Feedback
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Feedback Dialog */}
      <Dialog open={!!feedbackSession} onOpenChange={(open) => !open && setFeedbackSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-medium mb-2">Rating</p>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Comment (optional)</p>
              <Textarea
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleFeedbackSubmit}
              disabled={submitFeedback.isPending}
            >
              {submitFeedback.isPending ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
