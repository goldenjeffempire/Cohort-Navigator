import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, AlertTriangle, UserX, ScrollText } from "lucide-react";
import {
  useContentReports, useResolveReport, useSuspensions, useSuspendUser, useCommunityAuditLogs,
} from "@/lib/community";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  reviewing: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  dismissed: "bg-slate-100 text-slate-500",
};

export default function AdminModeration() {
  const { user } = useUser();
  const { toast } = useToast();
  const role = (user?.publicMetadata as any)?.role;

  if (role !== "admin") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Admin access required.</p>
      </div>
    );
  }

  const [reportFilter, setReportFilter] = useState("open");
  const { data: reports = [] } = useContentReports(reportFilter);
  const resolveReport = useResolveReport();
  const { data: suspensions = [] } = useSuspensions();
  const suspendUser = useSuspendUser();
  const { data: auditLogs = [] } = useCommunityAuditLogs();

  // Suspend dialog state
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendUserId, setSuspendUserId] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendExpires, setSuspendExpires] = useState("");

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveStatus, setResolveStatus] = useState("resolved");

  const openReports = (reports as any[]).filter((r: any) => r.status === "open").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Moderation</h1>
        {openReports > 0 && (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            {openReports} open report{openReports !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Reports
          </TabsTrigger>
          <TabsTrigger value="suspensions">
            <UserX className="h-3.5 w-3.5 mr-1.5" /> Suspensions
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ── Reports ── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="flex gap-2">
            {["open", "reviewing", "resolved", "dismissed"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={reportFilter === s ? "default" : "outline"}
                onClick={() => setReportFilter(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reports as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No {reportFilter} reports.
                    </TableCell>
                  </TableRow>
                ) : (
                  (reports as any[]).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">User #{r.reporterId}</TableCell>
                      <TableCell className="text-sm capitalize">
                        {r.targetType.replace("_", " ")} #{r.targetId}
                      </TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{r.reason}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {(r.status === "open" || r.status === "reviewing") && (
                          <Dialog open={resolveOpen === r.id} onOpenChange={(o) => { setResolveOpen(o ? r.id : null); setResolveNote(""); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs">Resolve</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Resolve Report #{r.id}</DialogTitle></DialogHeader>
                              <div className="space-y-4 pt-2">
                                <div className="space-y-1.5">
                                  <Label>Action</Label>
                                  <div className="flex gap-2">
                                    {["resolved", "dismissed"].map((s) => (
                                      <Button key={s} size="sm" variant={resolveStatus === s ? "default" : "outline"} onClick={() => setResolveStatus(s)} className="capitalize">
                                        {s}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Note (optional)</Label>
                                  <Input value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Resolution note..." />
                                </div>
                                <Button className="w-full" onClick={() => {
                                  resolveReport.mutate(
                                    { id: r.id, status: resolveStatus, resolutionNote: resolveNote || undefined },
                                    { onSuccess: () => { toast({ title: "Report resolved" }); setResolveOpen(null); }, onError: () => toast({ title: "Failed", variant: "destructive" }) },
                                  );
                                }} disabled={resolveReport.isPending}>
                                  {resolveReport.isPending ? "Saving…" : "Confirm"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Suspensions ── */}
        <TabsContent value="suspensions" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <UserX className="h-4 w-4 mr-1" /> Suspend User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Suspend User</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>User ID *</Label>
                    <Input type="number" value={suspendUserId} onChange={(e) => setSuspendUserId(e.target.value)} placeholder="Enter user ID" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reason *</Label>
                    <Input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Reason for suspension" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expires (optional — leave blank for indefinite)</Label>
                    <Input type="datetime-local" value={suspendExpires} onChange={(e) => setSuspendExpires(e.target.value)} />
                  </div>
                  <Button className="w-full" variant="destructive" onClick={() => {
                    const uid = parseInt(suspendUserId, 10);
                    if (Number.isNaN(uid) || !suspendReason.trim()) return;
                    suspendUser.mutate(
                      { userId: uid, reason: suspendReason.trim(), expiresAt: suspendExpires || undefined },
                      {
                        onSuccess: () => { toast({ title: "User suspended" }); setSuspendOpen(false); setSuspendUserId(""); setSuspendReason(""); setSuspendExpires(""); },
                        onError: () => toast({ title: "Failed to suspend", variant: "destructive" }),
                      },
                    );
                  }} disabled={suspendUser.isPending}>
                    {suspendUser.isPending ? "Suspending…" : "Suspend User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Suspended By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(suspensions as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No active suspensions.</TableCell>
                  </TableRow>
                ) : (
                  (suspensions as any[]).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">User #{s.userId}</TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{s.reason}</TableCell>
                      <TableCell className="text-sm">Admin #{s.suspendedById}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "Indefinite"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.liftedAt ? "outline" : "destructive"} className="text-xs">
                          {s.liftedAt ? "Lifted" : "Active"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Audit Log ── */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(auditLogs as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit events yet.</TableCell>
                  </TableRow>
                ) : (
                  (auditLogs as any[]).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {log.event.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">User #{log.actorId ?? "–"}</TableCell>
                      <TableCell className="text-sm">
                        {log.targetType ? `${log.targetType} #${log.targetId}` : "–"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{log.detail ?? "–"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
