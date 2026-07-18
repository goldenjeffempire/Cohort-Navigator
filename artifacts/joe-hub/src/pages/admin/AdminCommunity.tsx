import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Award, Globe, Users, Plus } from "lucide-react";
import { useCommunities, useBadges } from "@/lib/community";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";

export default function AdminCommunity() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const role = (user?.publicMetadata as any)?.role;

  if (role !== "admin") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Admin access required.</p>
      </div>
    );
  }

  const { data: communities = [], isLoading: loadingCommunities } = useCommunities();
  const { data: badges = [], isLoading: loadingBadges } = useBadges();

  const [badgeName, setBadgeName] = useState("");
  const [badgeDesc, setBadgeDesc] = useState("");
  const [badgeIcon, setBadgeIcon] = useState("award");
  const [badgeCategory, setBadgeCategory] = useState("participation");
  const [badgeOpen, setBadgeOpen] = useState(false);

  const createBadge = useMutation({
    mutationFn: (data: any) => customFetch("/api/badges", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badges"] });
      toast({ title: "Badge created!" });
      setBadgeOpen(false);
      setBadgeName(""); setBadgeDesc(""); setBadgeIcon("award"); setBadgeCategory("participation");
    },
    onError: () => toast({ title: "Failed to create badge", variant: "destructive" }),
  });

  const stats = {
    totalCommunities: (communities as any[]).length,
    totalMembers: (communities as any[]).reduce((sum: number, c: any) => sum + (c.memberCount ?? 0), 0),
    totalBadges: (badges as any[]).length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Community Management</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage communities, badges, and member roles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Communities", value: stats.totalCommunities, icon: Globe },
          { label: "Total Members", value: stats.totalMembers, icon: Users },
          { label: "Badges", value: stats.totalBadges, icon: Award },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Communities Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Communities</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCommunities ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                </TableRow>
              ) : (communities as any[]).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{c.kind}</Badge>
                  </TableCell>
                  <TableCell>{c.memberCount ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recognition Badges</h2>
          <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Badge</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Badge</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={badgeName} onChange={(e) => setBadgeName(e.target.value)} placeholder="Badge name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description *</Label>
                  <Input value={badgeDesc} onChange={(e) => setBadgeDesc(e.target.value)} placeholder="What is this badge for?" />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={badgeCategory} onValueChange={setBadgeCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["participation", "achievement", "mentorship", "leadership", "event"].map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => {
                  if (!badgeName.trim() || !badgeDesc.trim()) return;
                  createBadge.mutate({ name: badgeName, description: badgeDesc, icon: badgeIcon, category: badgeCategory });
                }} disabled={createBadge.isPending}>
                  {createBadge.isPending ? "Creating…" : "Create Badge"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {loadingBadges ? (
            [1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)
          ) : (badges as any[]).length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">No badges yet.</div>
          ) : (
            (badges as any[]).map((b: any) => (
              <Card key={b.id} className="text-center">
                <CardContent className="py-4 px-3">
                  <div className="text-2xl mb-1">🏅</div>
                  <p className="text-sm font-semibold">{b.name}</p>
                  <Badge variant="outline" className="text-xs capitalize mt-1">{b.category}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
