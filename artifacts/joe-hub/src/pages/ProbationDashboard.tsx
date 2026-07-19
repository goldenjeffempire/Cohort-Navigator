import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Clock, CheckCircle, Lock, ArrowRight,
  Star, Users, FileText, Shield, GraduationCap,
  Timer, AlertCircle
} from "lucide-react";
import { formatDistanceToNow, format, isPast } from "date-fns";

const PROBATION_RESOURCES = [
  { icon: BookOpen, title: "Welcome & Orientation", desc: "Platform tour and community introduction", available: true, href: "/courses" },
  { icon: Users, title: "Community Guidelines", desc: "How we collaborate and communicate", available: true, href: "/community" },
  { icon: Star, title: "Introductory Learning Resources", desc: "Beginner-level reading and videos", available: true, href: "/courses" },
  { icon: FileText, title: "Beginner Assignments", desc: "Practice exercises to warm up", available: true, href: "/assignments" },
  { icon: Lock, title: "Core Curriculum", desc: "Unlocks after full admission", available: false },
  { icon: Lock, title: "Coding Workspace", desc: "Unlocks after full admission", available: false },
  { icon: Lock, title: "Mentor Support", desc: "Unlocks after full admission", available: false },
  { icon: Lock, title: "Team Projects", desc: "Unlocks after full admission", available: false },
];

export default function ProbationDashboard({ name }: { name?: string }) {
  const { data: apps, isLoading } = useQuery({
    queryKey: ["/api/scholarship-applications/me"],
    queryFn: () => customFetch<any[]>("/api/scholarship-applications/me"),
  });

  const app = apps?.find((a: any) => a.status === "probation" || a.status === "probation_assessment");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  const probationEnd = app?.probation_end_date ? new Date(app.probation_end_date) : null;
  const assessmentUnlocked = app?.status === "probation_assessment" || (probationEnd && isPast(probationEnd));
  const daysLeft = probationEnd && !isPast(probationEnd)
    ? formatDistanceToNow(probationEnd, { addSuffix: true })
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge className="bg-white/20 text-white border-0 mb-3">🎯 Probation Period</Badge>
            <h2 className="text-2xl font-display font-bold mb-2">
              Welcome, {name?.split(" ")[0]}!
            </h2>
            <p className="text-white/80 max-w-lg leading-relaxed">
              You've been admitted to the JOE Forge probation programme. Complete the orientation resources and pass the admission assessment to gain full access.
            </p>
          </div>
          <Shield className="h-16 w-16 text-white/30 flex-shrink-0 hidden md:block" />
        </div>

        {/* Probation ID + dates */}
        {app && (
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {app.application_id && (
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Application ID</p>
                <p className="font-mono font-bold text-sm">{app.application_id}</p>
              </div>
            )}
            {app.probation_start_date && (
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Started</p>
                <p className="font-semibold text-sm">{format(new Date(app.probation_start_date), "MMM d, yyyy")}</p>
              </div>
            )}
            {probationEnd && (
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Assessment Unlocks</p>
                <p className="font-semibold text-sm">{format(probationEnd, "MMM d, yyyy")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assessment CTA or countdown */}
      {assessmentUnlocked ? (
        <Card className="border-2 border-indigo-400 bg-indigo-50 shadow-md">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="font-display font-bold text-gray-900 text-lg">Admission Assessment Ready!</h3>
                <p className="text-gray-600 text-sm">60-minute timed assessment · 70% passing score required</p>
              </div>
            </div>
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap" asChild>
              <Link href="/probation/assessment">
                Take Assessment <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : daysLeft ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5 flex items-center gap-4">
            <Timer className="h-10 w-10 text-amber-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-800">Assessment unlocks {daysLeft}</h3>
              <p className="text-amber-600 text-sm">Complete the orientation resources below while you wait.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Available Resources" value="4" color="text-primary" />
        <StatCard icon={Lock} label="Locked Features" value="4" color="text-gray-400" />
        <StatCard icon={Clock} label="Assessment Duration" value="60 min" color="text-indigo-600" />
        <StatCard icon={CheckCircle} label="Pass Score" value="70%" color="text-green-600" />
      </div>

      {/* Available resources */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="border-b border-gray-50 pb-4">
          <CardTitle className="font-display text-lg">Probation Resources</CardTitle>
          <CardDescription>Access these during your probation period.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {PROBATION_RESOURCES.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    item.available
                      ? "border-gray-200 bg-white hover:border-primary/30 hover:bg-primary/5"
                      : "border-gray-100 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.available ? "bg-primary/10" : "bg-gray-100"}`}>
                    <Icon className={`h-5 w-5 ${item.available ? "text-primary" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${item.available ? "text-gray-900" : "text-gray-400"}`}>{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                  {item.available && item.href ? (
                    <Button size="sm" variant="ghost" className="text-primary flex-shrink-0" asChild>
                      <Link href={item.href}><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  ) : !item.available ? (
                    <Lock className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* What happens next */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="border-b border-gray-50 pb-4">
          <CardTitle className="font-display text-lg">Your Admission Journey</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[
              { done: true,  label: "Account Created",          desc: "Clerk account verified" },
              { done: true,  label: "Application Submitted",     desc: "Scholarship application received" },
              { done: true,  label: "Application Reviewed",      desc: "Approved by admissions team" },
              { done: true,  label: "Probation Admitted",        desc: "1-week probation period started" },
              { done: assessmentUnlocked, active: !assessmentUnlocked, label: "Assessment Unlocked", desc: probationEnd ? `Unlocks ${format(probationEnd, "MMM d")}` : "After 1-week probation" },
              { done: false, active: assessmentUnlocked, label: "Admission Assessment",   desc: "Score 70% or above to pass" },
              { done: false, label: "Fully Admitted",            desc: "Gain complete platform access" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${step.done ? "bg-primary border-primary" : step.active ? "border-primary bg-primary/10" : "border-gray-200 bg-white"}`}>
                  {step.done ? <CheckCircle className="h-4 w-4 text-white" /> : <span className={`text-xs font-bold ${step.active ? "text-primary" : "text-gray-300"}`}>{i + 1}</span>}
                </div>
                <div className={!step.done && !step.active ? "opacity-50" : ""}>
                  <p className={`text-sm font-semibold ${step.done ? "text-gray-900" : step.active ? "text-primary" : "text-gray-500"}`}>{step.label}</p>
                  <p className="text-xs text-gray-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card className="shadow-sm border-gray-100">
      <CardContent className="p-5">
        <Icon className={`h-5 w-5 ${color} mb-3`} />
        <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
