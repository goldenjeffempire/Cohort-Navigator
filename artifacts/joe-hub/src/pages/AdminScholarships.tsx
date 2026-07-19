import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  FileText, CheckCircle, XCircle, Search, Eye, ArrowRight,
  BookOpen, GraduationCap, AlertCircle, Star, ExternalLink,
  Github, Linkedin, Globe, ChevronDown, ChevronUp, HelpCircle, X
} from "lucide-react";

type AppStatus = "pending" | "under_review" | "additional_info_requested" | "probation" | "probation_assessment" | "fully_admitted" | "not_admitted";

const STATUS_TABS: { value: AppStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "text-orange-600" },
  { value: "under_review", label: "Under Review", color: "text-blue-600" },
  { value: "additional_info_requested", label: "Info Needed", color: "text-yellow-700" },
  { value: "probation", label: "Probation", color: "text-purple-600" },
  { value: "probation_assessment", label: "Assessment", color: "text-indigo-600" },
  { value: "fully_admitted", label: "Admitted", color: "text-green-600" },
  { value: "not_admitted", label: "Rejected", color: "text-red-600" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700 border-orange-200",
  under_review: "bg-blue-100 text-blue-700 border-blue-200",
  additional_info_requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  probation: "bg-purple-100 text-purple-700 border-purple-200",
  probation_assessment: "bg-indigo-100 text-indigo-700 border-indigo-200",
  fully_admitted: "bg-green-100 text-green-700 border-green-200",
  not_admitted: "bg-red-100 text-red-700 border-red-200",
};

const ADVANCE_OPTIONS: { from: AppStatus; actions: { to: AppStatus; label: string; variant: "default" | "destructive" | "outline"; color?: string }[] }[] = [
  { from: "pending", actions: [
    { to: "under_review", label: "Begin Review", variant: "default" },
    { to: "additional_info_requested", label: "Request Info", variant: "outline" },
    { to: "not_admitted", label: "Reject", variant: "destructive" },
  ]},
  { from: "under_review", actions: [
    { to: "probation", label: "Admit to Probation", variant: "default", color: "bg-purple-600 hover:bg-purple-700" },
    { to: "additional_info_requested", label: "Request Info", variant: "outline" },
    { to: "not_admitted", label: "Reject", variant: "destructive" },
  ]},
  { from: "additional_info_requested", actions: [
    { to: "under_review", label: "Resume Review", variant: "default" },
    { to: "not_admitted", label: "Reject", variant: "destructive" },
  ]},
  { from: "probation", actions: [
    { to: "probation_assessment", label: "Unlock Assessment", variant: "default", color: "bg-indigo-600 hover:bg-indigo-700" },
  ]},
  { from: "probation_assessment", actions: [
    { to: "fully_admitted", label: "Fully Admit (≥70%)", variant: "default", color: "bg-green-600 hover:bg-green-700" },
    { to: "not_admitted", label: "Not Admitted (<70%)", variant: "destructive" },
  ]},
];

export default function AdminScholarships() {
  const [filter, setFilter] = useState<AppStatus>("pending");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");

  const { data: applications, isLoading } = useQuery({
    queryKey: ["/api/scholarship-applications", filter],
    queryFn: () => customFetch<any[]>(`/api/scholarship-applications?status=${filter}`),
  });

  const filtered = useMemo(() => {
    if (!applications || !search.trim()) return applications ?? [];
    const q = search.toLowerCase();
    return applications.filter((a: any) =>
      a.fullName?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.applicationId?.toLowerCase().includes(q) ||
      a.applicantName?.toLowerCase().includes(q)
    );
  }, [applications, search]);

  const advanceMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      customFetch<any>(`/api/scholarship-applications/${id}/advance`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Status Updated", description: "Application has been advanced in the workflow." });
      qc.invalidateQueries({ queryKey: ["/api/scholarship-applications"] });
      setActionDialog(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [viewApp, setViewApp] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ app: any; to: AppStatus } | null>(null);
  const [notes, setNotes] = useState("");
  const [score, setScore] = useState("");
  const [assessmentScore, setAssessmentScore] = useState("");

  const handleAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDialog) return;
    const body: any = {
      status: actionDialog.to,
      reviewNotes: notes || undefined,
    };
    if (score) body.score = parseInt(score, 10);
    if (assessmentScore) body.assessmentScore = parseInt(assessmentScore, 10);
    advanceMutation.mutate({ id: actionDialog.app.id, body });
  };

  const openAction = (app: any, to: AppStatus) => {
    setActionDialog({ app, to });
    setNotes("");
    setScore("");
    setAssessmentScore("");
  };

  const currentActions = ADVANCE_OPTIONS.find(o => o.from === filter)?.actions ?? [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Scholarship Applications</h1>
          <p className="text-gray-500 mt-1">Manage the full 7-step admission workflow.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/assessment-questions">
            <HelpCircle className="h-4 w-4 mr-2" /> Assessment Questions
          </Link>
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or application ID…"
          className="pl-10 pr-10 h-11"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v: any) => { setFilter(v); setSearch(""); }} className="w-full mb-6">
        <TabsList className="bg-gray-100 p-1 rounded-lg flex-wrap h-auto gap-1">
          {STATUS_TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-1.5 text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((app: any) => (
            <ApplicationCard
              key={app.id}
              app={app}
              actions={currentActions}
              onView={() => setViewApp(app)}
              onAction={openAction}
            />
          ))}
        </div>
      ) : (
        <div className="text-center p-16 bg-white rounded-xl border border-dashed border-gray-200">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {search ? `No results for "${search}"` : `No ${filter.replace(/_/g, " ")} applications`}
          </h3>
          <p className="text-gray-500">{search ? "Try a different name, email, or application ID." : "The queue is empty for this status."}</p>
          {search && <Button variant="ghost" className="mt-3" onClick={() => setSearch("")}>Clear search</Button>}
        </div>
      )}

      {/* Full Application View Dialog */}
      <Dialog open={!!viewApp} onOpenChange={open => !open && setViewApp(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{viewApp?.fullName} — Full Application</DialogTitle>
            <DialogDescription>Submitted {viewApp?.appliedAt && format(new Date(viewApp.appliedAt), "MMMM d, yyyy")}</DialogDescription>
          </DialogHeader>
          {viewApp && <ApplicationDetail app={viewApp} />}
        </DialogContent>
      </Dialog>

      {/* Advance Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={open => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Advance Application</DialogTitle>
            <DialogDescription>
              Moving <strong>{actionDialog?.app?.fullName}</strong> to{" "}
              <strong className="capitalize">{actionDialog?.to?.replace(/_/g, " ")}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdvance}>
            <div className="space-y-4 py-4">
              {(actionDialog?.to === "under_review" || actionDialog?.to === "probation") && (
                <div className="space-y-2">
                  <Label>Reviewer Score (0–100, optional)</Label>
                  <Input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} placeholder="e.g. 85" />
                </div>
              )}
              {(actionDialog?.to === "fully_admitted" || actionDialog?.to === "not_admitted") && (
                <div className="space-y-2">
                  <Label>Assessment Score (0–100) <span className="text-red-500">*</span></Label>
                  <Input type="number" min={0} max={100} required={actionDialog?.to === "not_admitted"} value={assessmentScore} onChange={e => setAssessmentScore(e.target.value)} placeholder="e.g. 72" />
                  <p className="text-xs text-gray-500">Passing score is 70%. {actionDialog?.to === "fully_admitted" ? "Confirm score ≥ 70%." : "Student did not reach the 70% threshold."}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes {actionDialog?.to === "additional_info_requested" ? <span className="text-red-500">*</span> : "(Optional)"}</Label>
                <Textarea
                  required={actionDialog?.to === "additional_info_requested"}
                  rows={4}
                  placeholder={
                    actionDialog?.to === "additional_info_requested"
                      ? "Describe exactly what additional information is needed..."
                      : actionDialog?.to === "not_admitted"
                      ? "Feedback for the applicant (shown to student)..."
                      : "Internal notes or message to the student..."
                  }
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button
                type="submit"
                disabled={advanceMutation.isPending}
                variant={actionDialog?.to === "not_admitted" ? "destructive" : "default"}
                className={actionDialog?.to === "fully_admitted" ? "bg-green-600 hover:bg-green-700" : actionDialog?.to === "probation" ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                {advanceMutation.isPending ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationCard({ app, actions, onView, onAction }: { app: any; actions: any[]; onView: () => void; onAction: (app: any, to: AppStatus) => void }) {
  const badgeClass = STATUS_BADGE[app.status] ?? STATUS_BADGE.pending;
  return (
    <Card className="shadow-sm border-gray-200 overflow-hidden">
      <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-lg text-gray-900">{app.fullName}</span>
            <Badge variant="outline" className={`text-xs ${badgeClass}`}>{app.status.replace(/_/g, " ")}</Badge>
            {app.applicationId && <span className="text-xs font-mono text-gray-400">{app.applicationId}</span>}
          </div>
          <span className="text-sm text-gray-500">{app.email}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Applied {format(new Date(app.appliedAt), "MMM d, yyyy")}</span>
          {app.preferredTrack && <Badge variant="outline" className="text-xs">{app.preferredTrack}</Badge>}
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="h-3.5 w-3.5 mr-1" /> View Full
          </Button>
          {actions.map(action => (
            <Button
              key={action.to}
              size="sm"
              variant={action.variant}
              className={action.color ?? ""}
              onClick={() => onAction(app, action.to)}
            >
              {action.label} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ))}
        </div>
      </div>
      <CardContent className="p-5">
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <Info label="Qualification" value={app.highestQualification} />
          <Info label="Employment" value={app.employmentStatus} />
          <Info label="Availability" value={app.availability} />
        </div>
        {app.motivationLetter && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Motivation (excerpt)</p>
            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{app.motivationLetter}</p>
          </div>
        )}
        {app.score !== null && app.score !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-700">Review score: <strong>{app.score}/100</strong></span>
          </div>
        )}
        {app.assessmentScore !== null && app.assessmentScore !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium text-gray-700">Assessment score: <strong>{app.assessmentScore}/100</strong>{" "}
              <span className={app.assessmentScore >= 70 ? "text-green-600" : "text-red-600"}>
                ({app.assessmentScore >= 70 ? "PASS" : "FAIL"})
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationDetail({ app }: { app: any }) {
  const [expanded, setExpanded] = useState<string | null>("personal");
  const toggle = (s: string) => setExpanded(e => e === s ? null : s);

  const Section = ({ id, title, icon: Icon, children }: any) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <button className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={() => toggle(id)}>
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
        </div>
        {expanded === id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {expanded === id && <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-4">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-2 mt-2">
      <Section id="personal" title="Personal Information" icon={FileText}>
        <DField label="Full Name" v={app.fullName} />
        <DField label="Email" v={app.email} />
        <DField label="Gender" v={app.gender} />
        <DField label="Date of Birth" v={app.dateOfBirth} />
        <DField label="Nationality" v={app.nationality} />
        <DField label="Phone" v={app.phone} />
        <DField label="State" v={app.state} />
        <DField label="City" v={app.city} />
        <DField label="Address" v={app.address} full />
        <DField label="Emergency Contact" v={app.emergencyContact} full />
      </Section>

      <Section id="education" title="Educational Background" icon={BookOpen}>
        <DField label="Highest Qualification" v={app.highestQualification} />
        <DField label="Institution" v={app.institution} />
        <DField label="Course of Study" v={app.courseOfStudy} />
        <DField label="Graduation Year" v={app.graduationYear} />
      </Section>

      <Section id="professional" title="Professional Information" icon={Star}>
        <DField label="Employment Status" v={app.employmentStatus} />
        <DField label="Technical Experience" v={app.technicalExperience} full />
        <DField label="Programming Experience" v={app.programmingExperience} full />
        <DField label="AI Experience" v={app.aiExperience} full />
        <DField label="Previous Projects" v={app.previousProjects} full />
        {app.githubUrl && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">GitHub</p>
            <a href={app.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm flex items-center gap-1 hover:underline">
              <Github className="h-3.5 w-3.5" /> {app.githubUrl}
            </a>
          </div>
        )}
        {app.linkedinUrl && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">LinkedIn</p>
            <a href={app.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm flex items-center gap-1 hover:underline">
              <Linkedin className="h-3.5 w-3.5" /> {app.linkedinUrl}
            </a>
          </div>
        )}
        {app.portfolioUrl && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Portfolio</p>
            <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm flex items-center gap-1 hover:underline">
              <Globe className="h-3.5 w-3.5" /> {app.portfolioUrl}
            </a>
          </div>
        )}
      </Section>

      <Section id="scholarship" title="Scholarship Information" icon={GraduationCap}>
        <DField label="Preferred Track" v={app.preferredTrack} />
        <DField label="Availability" v={app.availability} />
        <DField label="Internet Access" v={app.hasInternetAccess ? "Yes" : "No"} />
        <DField label="Has Computer" v={app.hasComputer ? "Yes" : "No"} />
        <DField label="Career Goals" v={app.careerGoals} full />
        <DField label="Motivation Letter" v={app.motivationLetter} full />
      </Section>

      {app.reviewNotes && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Review Notes</p>
          <p className="text-sm text-amber-900">{app.reviewNotes}</p>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <p className="font-medium text-gray-800 text-sm">{value}</p>
    </div>
  );
}

function DField({ label, v, full }: { label: string; v?: string | null; full?: boolean }) {
  if (!v) return null;
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 leading-snug">{v}</p>
    </div>
  );
}
