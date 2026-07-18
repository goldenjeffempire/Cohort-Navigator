import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, MapPin, Clock, Calendar } from "lucide-react";
import { useMentorProfile, useMentorAvailability, useBookSession } from "@/lib/community";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function InitialsAvatar({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="h-20 w-20 rounded-full object-cover" />;
  return (
    <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function MentorProfile() {
  const [, params] = useRoute("/mentorship/:userId");
  const userId = parseInt(params?.userId ?? "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: profile, isLoading: loadingProfile } = useMentorProfile(userId);
  const { data: slots = [] } = useMentorAvailability(userId);
  const bookMutation = useBookSession();

  const [format, setFormat] = useState<"one_on_one" | "group">("one_on_one");
  const [topic, setTopic] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [booking, setBooking] = useState(false);

  const handleBook = () => {
    if (!startsAt || !endsAt) {
      toast({ title: "Please select start and end times", variant: "destructive" });
      return;
    }
    setBooking(true);
    bookMutation.mutate(
      { mentorId: userId, format, topic: topic || undefined, startsAt, endsAt },
      {
        onSuccess: () => {
          toast({ title: "Session booked! Check My Sessions for details." });
          setLocation("/mentorship");
        },
        onError: (e: any) => {
          toast({ title: e?.message ?? "Failed to book session", variant: "destructive" });
          setBooking(false);
        },
      },
    );
  };

  if (loadingProfile) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-6 text-muted-foreground">Mentor profile not found.</div>;
  }

  const p = profile as any;

  // Group slots by day
  const slotsByDay = new Map<number, any[]>();
  (slots as any[]).forEach((slot: any) => {
    if (!slotsByDay.has(slot.dayOfWeek)) slotsByDay.set(slot.dayOfWeek, []);
    slotsByDay.get(slot.dayOfWeek)!.push(slot);
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/mentorship">
        <Button variant="ghost" size="sm" className="-ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Mentors
        </Button>
      </Link>

      {/* Profile card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <InitialsAvatar name={p.name} avatarUrl={p.avatarUrl} />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{p.name ?? `Mentor #${userId}`}</h1>
              {p.headline && <p className="text-muted-foreground mt-0.5">{p.headline}</p>}

              <div className="flex flex-wrap items-center gap-3 mt-3">
                {p.isAcceptingBookings ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" /> Accepting Bookings
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Not accepting bookings</Badge>
                )}
                {p.timezone && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {p.timezone}
                  </span>
                )}
              </div>

              {p.expertise && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.expertise.split(",").map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag.trim()}</Badge>
                  ))}
                </div>
              )}

              {p.bio && (
                <p className="mt-4 text-sm leading-relaxed text-foreground/80">{p.bio}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Office Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(slots as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No availability slots configured.</p>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day, idx) => {
                const daySlots = slotsByDay.get(idx) ?? [];
                return (
                  <div key={day} className="text-center">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{day}</p>
                    <div className="space-y-1">
                      {daySlots.filter((s: any) => s.isActive).map((slot: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            const now = new Date();
                            const dayDiff = (idx - now.getDay() + 7) % 7 || 7;
                            const date = new Date(now);
                            date.setDate(date.getDate() + dayDiff);
                            const start = new Date(date);
                            start.setHours(Math.floor(slot.startMinute / 60), slot.startMinute % 60, 0, 0);
                            const end = new Date(date);
                            end.setHours(Math.floor(slot.endMinute / 60), slot.endMinute % 60, 0, 0);
                            setStartsAt(start.toISOString().slice(0, 16));
                            setEndsAt(end.toISOString().slice(0, 16));
                          }}
                          className="w-full text-[10px] bg-green-100 text-green-700 rounded px-0.5 py-0.5 hover:bg-green-200 transition-colors block"
                        >
                          {minutesToTime(slot.startMinute)}
                        </button>
                      ))}
                      {daySlots.length === 0 && (
                        <div className="h-6 bg-muted/30 rounded text-xs flex items-center justify-center text-muted-foreground/40">–</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking form */}
      {p.isAcceptingBookings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Book a Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Format */}
            <div className="space-y-1.5">
              <Label>Session Format</Label>
              <div className="flex gap-3">
                {(["one_on_one", "group"] as const).map((f) => (
                  <label key={f} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value={f}
                      checked={format === f}
                      onChange={() => setFormat(f)}
                      className="accent-primary"
                    />
                    <span className="text-sm capitalize">{f.replace("_", "-")}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <Label>Topic (optional)</Label>
              <Input
                placeholder="What do you want to discuss?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleBook}
              disabled={booking || !startsAt || !endsAt}
            >
              {booking ? "Booking…" : "Book Session"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
