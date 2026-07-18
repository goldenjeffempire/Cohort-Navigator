import { useState } from "react";
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
import {
  Calendar, Clock, Users, Video, Plus, ExternalLink, Zap, Trophy,
} from "lucide-react";
import { useLiveSessions, useRsvpSession, useCreateLiveSession } from "@/lib/community";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const TYPE_STYLES: Record<string, { color: string; icon: typeof Calendar }> = {
  class: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: Calendar },
  webinar: { color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Video },
  office_hours: { color: "bg-teal-100 text-teal-700 border-teal-200", icon: Clock },
  event: { color: "bg-orange-100 text-orange-700 border-orange-200", icon: Calendar },
  hackathon: { color: "bg-red-100 text-red-700 border-red-200", icon: Zap },
  competition: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Trophy },
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-600",
  live: "bg-green-100 text-green-700 animate-pulse",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-50 text-red-400",
};

const RSVP_LABELS: Record<string, string> = {
  going: "Going ✓",
  interested: "Interested",
  declined: "Declined",
};

function EventCard({ session, onRsvp }: { session: any; onRsvp: (sessionId: number, status: string) => void }) {
  const typeInfo = TYPE_STYLES[session.type] ?? TYPE_STYLES.event;
  const Icon = typeInfo.icon;

  return (
    <Card className={`${session.status === "cancelled" ? "opacity-60" : ""}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm">{session.title}</h3>
                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${typeInfo.color}`}>
                  {session.type.replace("_", " ")}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[session.status]}`}>
                  {session.status}
                </span>
              </div>
              {session.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{session.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {session.hostName && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {session.hostName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(session.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className="text-muted-foreground/60">
                  {session.rsvpCount ?? 0} going
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            {session.status === "live" && session.meetingLink && (
              <a href={session.meetingLink} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Join Now
                </Button>
              </a>
            )}
            {session.status === "scheduled" && (
              <div className="flex gap-1">
                {(["going", "interested", "declined"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={session.myRsvp === s ? "default" : "outline"}
                    className="text-xs px-2 h-7"
                    onClick={() => onRsvp(session.id, s)}
                  >
                    {s === "going" ? "✓" : s === "interested" ? "?" : "✗"}
                  </Button>
                ))}
              </div>
            )}
            {session.myRsvp && (
              <p className="text-xs text-muted-foreground text-right">
                {RSVP_LABELS[session.myRsvp]}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateEventDialog({ onCreated }: { onCreated?: () => void }) {
  const { toast } = useToast();
  const createSession = useCreateLiveSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("class");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !startsAt || !endsAt) {
      toast({ title: "Title and times are required", variant: "destructive" });
      return;
    }
    createSession.mutate(
      { title: title.trim(), description: description || undefined, type, startsAt, endsAt, meetingLink: meetingLink || undefined },
      {
        onSuccess: () => {
          toast({ title: "Event created!" });
          setOpen(false);
          setTitle(""); setDescription(""); setStartsAt(""); setEndsAt(""); setMeetingLink("");
          onCreated?.();
        },
        onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Event</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Live Event</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this about?" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(TYPE_STYLES).map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start *</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End *</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Meeting Link</Label>
            <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://..." />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={createSession.isPending}>
            {createSession.isPending ? "Creating…" : "Create Event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EventsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const role = (user?.publicMetadata as any)?.role;
  const isStaff = role === "admin" || role === "mentor";

  const { data: upcoming = [] } = useLiveSessions({ upcoming: true });
  const { data: allEvents = [] } = useLiveSessions();
  const { data: hackathons = [] } = useLiveSessions({ type: "hackathon" });
  const { data: competitions = [] } = useLiveSessions({ type: "competition" });
  const rsvpMutation = useRsvpSession();

  const hackathonEvents = [
    ...(hackathons as any[]),
    ...(competitions as any[]).filter((c: any) => !(hackathons as any[]).find((h: any) => h.id === c.id)),
  ];

  const myRsvps = (allEvents as any[]).filter((e: any) => e.myRsvp === "going" || e.myRsvp === "interested");

  const handleRsvp = (sessionId: number, status: string) => {
    rsvpMutation.mutate(
      { sessionId, status },
      { onError: () => toast({ title: "RSVP failed", variant: "destructive" }) },
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events & Live Sessions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Classes, webinars, hackathons, and more</p>
        </div>
        {isStaff && <CreateEventDialog />}
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({(upcoming as any[]).length})</TabsTrigger>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="mine">My RSVPs ({myRsvps.length})</TabsTrigger>
          <TabsTrigger value="hackathons">Hackathons & Competitions</TabsTrigger>
        </TabsList>

        {[
          { value: "upcoming", data: upcoming },
          { value: "all", data: allEvents },
          { value: "mine", data: myRsvps },
          { value: "hackathons", data: hackathonEvents },
        ].map(({ value, data }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-3">
            {(data as any[]).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>
                    {value === "upcoming" ? "No upcoming events scheduled." :
                     value === "mine" ? "You haven't RSVPed to any events." :
                     value === "hackathons" ? "No hackathons or competitions scheduled." :
                     "No events yet."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              (data as any[]).map((session: any) => (
                <EventCard key={session.id} session={session} onRsvp={handleRsvp} />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
