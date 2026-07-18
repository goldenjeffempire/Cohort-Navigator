import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, MessageSquare, BookOpen, Calendar, Award, Trophy,
  Users2, ArrowRight, Globe, Shield,
} from "lucide-react";
import {
  useCommunities,
  useBadges,
  useMyBadges,
} from "@/lib/community";

const NAV_ITEMS = [
  { label: "Discussions", href: "/discussions", icon: MessageSquare, description: "Ask questions, share ideas, and learn together" },
  { label: "Messages", href: "/messages", icon: MessageSquare, description: "Private and group conversations" },
  { label: "Mentorship", href: "/mentorship", icon: Users2, description: "Connect with mentors and book sessions" },
  { label: "Teams", href: "/teams", icon: Users, description: "Collaborate on projects and study groups" },
  { label: "Events", href: "/events", icon: Calendar, description: "Live classes, webinars, and hackathons" },
  { label: "AI Hub", href: "/ai", icon: BookOpen, description: "AI-powered tutoring and career tools" },
];

function InitialsAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function CommunityHub() {
  const { data: communities = [], isLoading: loadingCommunities } = useCommunities();
  const { data: badges = [] } = useBadges();
  const { data: myBadges = [] } = useMyBadges();

  const myBadgeIds = new Set((myBadges as any[]).map((b: any) => b.id ?? b.badgeId));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Connect, collaborate, and grow with your cohort
        </p>
      </div>

      {/* Quick-nav grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Explore</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Your Communities */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Communities</h2>
        </div>
        {loadingCommunities ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : communities.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>You haven't joined any communities yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(communities as any[]).map((community: any) => (
              <Card key={community.id} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {community.kind === "global" ? (
                          <Globe className="h-5 w-5 text-primary" />
                        ) : (
                          <Users className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{community.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {community.memberCount ?? 0} members
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {community.kind}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {community.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {community.description}
                    </p>
                  )}
                  <Link href={`/community/${community.id}`}>
                    <Button size="sm" variant="outline" className="w-full">
                      Open <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Badges & Recognition</h2>
        </div>
        {(badges as any[]).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Trophy className="h-7 w-7 mx-auto mb-2 opacity-40" />
              <p>No badges available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(badges as any[]).map((badge: any) => {
              const earned = myBadgeIds.has(badge.id);
              return (
                <Card key={badge.id} className={`text-center ${earned ? "border-primary/50 bg-primary/5" : "opacity-60"}`}>
                  <CardContent className="py-4 px-3">
                    <div className="text-2xl mb-1">🏆</div>
                    <p className="text-sm font-semibold">{badge.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
                    {earned && (
                      <Badge className="mt-2 text-xs" variant="default">Earned</Badge>
                    )}
                    <Badge variant="outline" className="mt-2 text-xs capitalize block">
                      {badge.category}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
