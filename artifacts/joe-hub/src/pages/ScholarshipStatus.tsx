import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Clock, CheckCircle, XCircle, FileText, ArrowRight, BookOpen,
  Shield, Star, GraduationCap, AlertCircle, Info
} from "lucide-react";
import { format } from "date-fns";

const WORKFLOW_STEPS = [
  { key: "pending",                   label: "Application Submitted",    desc: "Your application has been received and is in the queue." },
  { key: "under_review",              label: "Under Review",             desc: "Our admissions team is actively reviewing your application." },
  { key: "additional_info_requested", label: "Info Requested",           desc: "We need additional information from you." },
  { key: "probation",                 label: "Probation Admission",      desc: "You've been admitted to the 1-week probation programme." },
  { key: "probation_assessment",      label: "Probation Assessment",     desc: "Complete the admission assessment (70% passing score required)." },
  { key: "fully_admitted",            label: "Fully Admitted",           desc: "Congratulations — you are a full JOE Hub student!" },
];

const STATUS_META: Record<string, { color: string; bg: string; border: string; badge: string; icon: any; label: string }> = {
  draft:                    { color: "text-gray-500",   bg: "bg-gray-50",    border: "border-gray-200",  badge: "bg-gray-400",   icon: FileText,     label: "Draft" },
  pending:                  { color: "text-orange-600", bg: "bg-orange-50",  border: "border-orange-200",badge: "bg-orange-500", icon: Clock,        label: "Pending Review" },
  under_review:             { color: "text-blue-600",   bg: "bg-blue-50",    border: "border-blue-200",  badge: "bg-blue-500",   icon: Shield,       label: "Under Review" },
  additional_info_requested:{ color: "text-yellow-700", bg: "bg-yellow-50",  border: "border-yellow-200",badge: "bg-yellow-500", icon: AlertCircle,  label: "Info Requested" },
  probation:                { color: "text-purple-600", bg: "bg-purple-50",  border: "border-purple-200",badge: "bg-purple-500", icon: BookOpen,     label: "Probation" },
  probation_assessment:     { color: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-200",badge: "bg-indigo-500", icon: Star,         label: "Assessment" },
  fully_admitted:           { color: "text-green-600",  bg: "bg-green-50",   border: "border-green-200", badge: "bg-green-600",  icon: GraduationCap,label: "Fully Admitted" },
  not_admitted:             { color: "text-red-600",    bg: "bg-red-50",     border: "border-red-200",   badge: "bg-red-600",    icon: XCircle,      label: "Not Admitted" },
};

function getStepIndex(status: string) {
  const map: Record<string, number> = {
    draft: -1, pending: 0, under_review: 1, additional_info_requested: 1,
    probation: 2, probation_assessment: 3, fully_admitted: 4, not_admitted: -2,
  };
  return map[status] ?? 0;
}

export default function ScholarshipStatus() {
  const { data: apps, isLoading } = useQuery({
    queryKey: ["/api/scholarship-applications/me"],
    queryFn: () => customFetch<any[]>("/api/scholarship-applications/me"),
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const activeApp = apps?.find((a: any) => a.status !== "draft" && a.status !== "not_admitted")
    ?? apps?.[0];

  if (!activeApp) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="text-center p-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <FileText className="h-16 w-16 text-gray-200 mx-auto mb-6" />
          <h3 className="text-2xl font-display font-bold text-gray-900 mb-3">Start Your Journey</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-8">You haven't applied for a scholarship yet. Ready to launch your tech career?</p>
          <Button size="lg" className="h-14 px-8" asChild>
            <Link href="/scholarship/apply">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[activeApp.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const currentStep = getStepIndex(activeApp.status);
  const isFullyAdmitted = activeApp.status === "fully_admitted";
  const isNotAdmitted = activeApp.status === "not_admitted";

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Application Status</h1>
          <p className="text-gray-500 mt-1">Track your admission progress</p>
        </div>
        {(activeApp.status === "draft" || activeApp.status === "not_admitted") && (
          <Button asChild>
            <Link href="/scholarship/apply">{activeApp.status === "draft" ? "Continue Application" : "Reapply"}</Link>
          </Button>
        )}
      </div>

      {/* Status banner */}
      <div className={`rounded-2xl border-2 ${meta.border} ${meta.bg} mb-6 overflow-hidden`}>
        <div className={`px-6 py-4 flex items-center gap-3 border-b ${meta.border}`}>
          <Icon className={`h-6 w-6 ${meta.color}`} />
          <span className={`font-bold text-lg ${meta.color}`}>{meta.label}</span>
          <span className="ml-auto text-sm text-gray-500">Applied {format(new Date(activeApp.appliedAt), "MMMM d, yyyy")}</span>
        </div>
        <div className="px-6 py-5 bg-white">
          {activeApp.status === "additional_info_requested" && activeApp.reviewNotes && (
            <div className="flex gap-3 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 text-sm mb-1">Message from the admissions team:</p>
                <p className="text-yellow-700 text-sm leading-relaxed">"{activeApp.reviewNotes}"</p>
              </div>
            </div>
          )}
          {activeApp.status === "probation" && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <p className="text-xs text-purple-500 uppercase tracking-wide font-semibold mb-1">Probation ID</p>
                <p className="font-mono font-bold text-purple-900">{activeApp.applicantName || "—"}</p>
              </div>
              {activeApp.probationStartDate && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-xs text-purple-500 uppercase tracking-wide font-semibold mb-1">Started</p>
                  <p className="font-medium text-purple-900">{format(new Date(activeApp.probationStartDate), "MMM d, yyyy")}</p>
                </div>
              )}
              {activeApp.probationEndDate && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-xs text-purple-500 uppercase tracking-wide font-semibold mb-1">Assessment Unlocks</p>
                  <p className="font-medium text-purple-900">{format(new Date(activeApp.probationEndDate), "MMM d, yyyy")}</p>
                </div>
              )}
            </div>
          )}
          {isFullyAdmitted && (
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div>
                <p className="text-green-700 font-semibold mb-1">🎉 Welcome to JOE Hub! Your full access is now active.</p>
                {activeApp.reviewNotes && <p className="text-sm text-gray-600">{activeApp.reviewNotes}</p>}
              </div>
              <Button className="bg-green-600 hover:bg-green-700 whitespace-nowrap" asChild>
                <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          )}
          {isNotAdmitted && (
            <div>
              <p className="text-red-700 font-semibold mb-2">We regret that we are unable to offer you full admission at this time.</p>
              {activeApp.assessmentScore !== null && activeApp.assessmentScore !== undefined && (
                <p className="text-sm text-gray-600 mb-1">Assessment Score: <strong>{activeApp.assessmentScore}%</strong> (passing: 70%)</p>
              )}
              {activeApp.reviewNotes && <p className="text-sm text-gray-600 italic">"{activeApp.reviewNotes}"</p>}
              <p className="text-sm text-gray-500 mt-3">You may reapply based on the platform's reapplication policy. Keep learning and improving!</p>
            </div>
          )}
          {!isFullyAdmitted && !isNotAdmitted && activeApp.status !== "additional_info_requested" && activeApp.status !== "probation" && (
            <p className="text-gray-600 text-sm leading-relaxed">
              {activeApp.status === "pending" && "Your application has been submitted and is awaiting review. You will be notified of any updates."}
              {activeApp.status === "under_review" && "Our admissions team is actively reviewing your application. This usually takes 3–5 business days."}
              {activeApp.status === "probation_assessment" && "Your probation period is complete. The admission assessment is now unlocked — log in to take it."}
            </p>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      {!isNotAdmitted && (
        <Card className="shadow-sm border-gray-100 mb-6">
          <CardContent className="p-6">
            <h3 className="font-display font-semibold text-gray-900 mb-6">Admission Progress</h3>
            <div className="relative">
              {/* Connector line */}
              <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {WORKFLOW_STEPS.map((wStep, i) => {
                  const done = currentStep > i || isFullyAdmitted;
                  const active = currentStep === i && !isFullyAdmitted;
                  return (
                    <div key={wStep.key} className="flex items-start gap-4 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10 transition-all ${
                        done ? "bg-primary border-primary" :
                        active ? "border-primary bg-primary/10" :
                        "border-gray-200 bg-white"
                      }`}>
                        {done ? (
                          <CheckCircle className="h-5 w-5 text-white" />
                        ) : (
                          <span className={`text-sm font-bold ${active ? "text-primary" : "text-gray-300"}`}>{i + 1}</span>
                        )}
                      </div>
                      <div className={`flex-1 pt-1.5 ${!done && !active ? "opacity-50" : ""}`}>
                        <p className={`font-semibold text-sm ${done || active ? "text-gray-900" : "text-gray-400"}`}>{wStep.label}</p>
                        {(done || active) && <p className="text-xs text-gray-500 mt-0.5">{wStep.desc}</p>}
                      </div>
                      {active && (
                        <Badge className={`${meta.badge} text-white text-xs flex-shrink-0 mt-1`}>Current</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application details */}
      <Card className="shadow-sm border-gray-100">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold text-gray-900 mb-4">Application Details</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <DetailItem label="Preferred Track" value={activeApp.preferredTrack} />
            <DetailItem label="Cohort" value={activeApp.cohortId ? `Cohort #${activeApp.cohortId}` : "Any available"} />
            <DetailItem label="Nationality" value={activeApp.nationality} />
            <DetailItem label="Highest Qualification" value={activeApp.highestQualification} />
            {activeApp.githubUrl && <DetailItem label="GitHub" value={activeApp.githubUrl} link />}
            {activeApp.linkedinUrl && <DetailItem label="LinkedIn" value={activeApp.linkedinUrl} link />}
          </div>
          {activeApp.motivationLetter && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Motivation Letter</h4>
              <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 leading-relaxed max-h-48 overflow-y-auto border border-gray-100">
                {activeApp.motivationLetter}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailItem({ label, value, link }: { label: string; value?: string; link?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline truncate block">{value}</a>
      ) : (
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      )}
    </div>
  );
}
