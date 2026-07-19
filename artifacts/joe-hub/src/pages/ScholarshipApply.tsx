import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Award, ArrowRight, ArrowLeft, Save, CheckCircle, User, GraduationCap, Briefcase, FileText, Shield } from "lucide-react";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Education", icon: GraduationCap },
  { id: 3, title: "Professional", icon: Briefcase },
  { id: 4, title: "Scholarship", icon: FileText },
  { id: 5, title: "Agreements", icon: Shield },
];

const TRACKS = ["Software Engineering", "Artificial Intelligence", "Data Science", "Cloud & DevOps", "Cybersecurity", "Product Management"];
const QUALIFICATIONS = ["Secondary School", "OND / Associate Degree", "HND / Bachelor's Degree", "Postgraduate Diploma", "Master's Degree", "PhD", "Professional Certification"];
const EMPLOYMENT = ["Employed Full-time", "Employed Part-time", "Freelancer / Self-employed", "Student", "Unemployed", "Other"];

const emptyForm = {
  fullName: "", email: "", gender: "", dateOfBirth: "", nationality: "", state: "", city: "", address: "", phone: "", emergencyContact: "",
  highestQualification: "", institution: "", courseOfStudy: "", graduationYear: "",
  employmentStatus: "", technicalExperience: "", programmingExperience: "", aiExperience: "", previousProjects: "", portfolioUrl: "", githubUrl: "", linkedinUrl: "",
  essay: "", careerGoals: "", motivationLetter: "", availability: "", hasInternetAccess: false, hasComputer: false, preferredTrack: "",
  agreedToCodeOfConduct: false, agreedToScholarshipAgreement: false, agreedToPrivacyPolicy: false, agreedToTerms: false,
};

export default function ScholarshipApply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...emptyForm });

  // Pre-fill from user profile
  useEffect(() => {
    if (me) setForm(f => ({ ...f, fullName: f.fullName || me.name || "", email: f.email || me.email || "" }));
  }, [me]);

  // Load existing draft
  const { data: existingApps } = useQuery({
    queryKey: ["/api/scholarship-applications/me"],
    queryFn: () => customFetch<any[]>("/api/scholarship-applications/me"),
  });

  useEffect(() => {
    if (!existingApps) return;
    const draft = existingApps.find((a: any) => a.status === "draft");
    if (draft) {
      setForm(f => ({ ...f, ...draft }));
    } else if (existingApps.some((a: any) => !["not_admitted"].includes(a.status))) {
      // Active application — redirect to status
      setLocation("/scholarship/status");
    }
  }, [existingApps, setLocation]);

  const saveMutation = useMutation({
    mutationFn: (status: "draft" | "pending") =>
      customFetch<any>("/api/scholarship-applications", {
        method: "POST",
        body: JSON.stringify({ ...form, status }),
      }),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ["/api/scholarship-applications/me"] });
      if (status === "pending") {
        toast({ title: "Application Submitted!", description: "Your application is now under review." });
        setLocation("/scholarship/status");
      } else {
        toast({ title: "Draft Saved", description: "Your progress has been saved." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Something went wrong.", variant: "destructive" });
    },
  });

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const canSubmit =
    form.agreedToCodeOfConduct &&
    form.agreedToScholarshipAgreement &&
    form.agreedToPrivacyPolicy &&
    form.agreedToTerms &&
    form.fullName &&
    form.email &&
    form.motivationLetter;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
          <Award className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-display font-bold text-gray-900">JOE Forge Scholarship Application</h1>
        <p className="text-gray-500 mt-2 max-w-lg mx-auto">Complete all sections to apply. You can save a draft at any time.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                className={`flex flex-col items-center gap-1 ${step > s.id ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done ? "bg-primary border-primary text-white" : active ? "border-primary text-primary bg-primary/10" : "border-gray-200 text-gray-400 bg-white"
                }`}>
                  {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? "text-primary" : done ? "text-gray-600" : "text-gray-400"}`}>{s.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.id ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="shadow-lg border-gray-200 border-t-4 border-t-primary">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 px-8 py-6">
          <CardTitle className="text-xl font-display">
            Step {step} of {STEPS.length} — {STEPS[step - 1].title}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Tell us about yourself."}
            {step === 2 && "Share your educational background."}
            {step === 3 && "Describe your professional experience."}
            {step === 4 && "Tell us why you want to join JOE Forge."}
            {step === 5 && "Review and accept the agreements before submitting."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 space-y-6">

          {/* Step 1: Personal */}
          {step === 1 && (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Full Name" required>
                  <Input value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder="e.g. Ada Okafor" />
                </Field>
                <Field label="Email Address" required>
                  <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" />
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Gender">
                  <Select value={form.gender} onValueChange={v => set("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} />
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Nationality">
                  <Input value={form.nationality} onChange={e => set("nationality", e.target.value)} placeholder="e.g. Nigerian" />
                </Field>
                <Field label="Phone Number">
                  <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+234 800 000 0000" />
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="State">
                  <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="e.g. Lagos" />
                </Field>
                <Field label="City">
                  <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Ikeja" />
                </Field>
              </div>
              <Field label="Residential Address">
                <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" />
              </Field>
              <Field label="Emergency Contact" hint="Name, relationship and phone number">
                <Input value={form.emergencyContact} onChange={e => set("emergencyContact", e.target.value)} placeholder="e.g. John Okafor (Father) — +234 800 000 0001" />
              </Field>
            </>
          )}

          {/* Step 2: Education */}
          {step === 2 && (
            <>
              <Field label="Highest Qualification">
                <Select value={form.highestQualification} onValueChange={v => set("highestQualification", v)}>
                  <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                  <SelectContent>
                    {QUALIFICATIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Institution / University">
                  <Input value={form.institution} onChange={e => set("institution", e.target.value)} placeholder="e.g. University of Lagos" />
                </Field>
                <Field label="Course of Study">
                  <Input value={form.courseOfStudy} onChange={e => set("courseOfStudy", e.target.value)} placeholder="e.g. Computer Science" />
                </Field>
              </div>
              <Field label="Graduation Year (or Expected)">
                <Input value={form.graduationYear} onChange={e => set("graduationYear", e.target.value)} placeholder="e.g. 2023" />
              </Field>
            </>
          )}

          {/* Step 3: Professional */}
          {step === 3 && (
            <>
              <Field label="Employment Status">
                <Select value={form.employmentStatus} onValueChange={v => set("employmentStatus", v)}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Technical Experience" hint="Overall experience with technology (e.g. 2 years building web apps)">
                <Textarea rows={3} value={form.technicalExperience} onChange={e => set("technicalExperience", e.target.value)} placeholder="Describe your general tech background..." />
              </Field>
              <Field label="Programming Experience" hint="Languages and frameworks you know">
                <Textarea rows={3} value={form.programmingExperience} onChange={e => set("programmingExperience", e.target.value)} placeholder="e.g. Python (2 yrs), JavaScript/React (1 yr)..." />
              </Field>
              <Field label="AI / ML Experience">
                <Textarea rows={2} value={form.aiExperience} onChange={e => set("aiExperience", e.target.value)} placeholder="Any exposure to AI, machine learning, or data science..." />
              </Field>
              <Field label="Previous Projects" hint="Key projects you've built">
                <Textarea rows={3} value={form.previousProjects} onChange={e => set("previousProjects", e.target.value)} placeholder="Describe notable projects (name, tech stack, outcome)..." />
              </Field>
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="GitHub Profile URL">
                  <Input value={form.githubUrl} onChange={e => set("githubUrl", e.target.value)} placeholder="https://github.com/username" />
                </Field>
                <Field label="LinkedIn Profile URL">
                  <Input value={form.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/username" />
                </Field>
              </div>
              <Field label="Portfolio / Website URL">
                <Input value={form.portfolioUrl} onChange={e => set("portfolioUrl", e.target.value)} placeholder="https://yourportfolio.com" />
              </Field>
            </>
          )}

          {/* Step 4: Scholarship */}
          {step === 4 && (
            <>
              <Field label="Preferred Learning Track" required>
                <Select value={form.preferredTrack} onValueChange={v => set("preferredTrack", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a track" /></SelectTrigger>
                  <SelectContent>
                    {TRACKS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Motivation Letter" required hint="Why do you want to join JOE Forge? (minimum 200 words)">
                <Textarea rows={8} value={form.motivationLetter} onChange={e => set("motivationLetter", e.target.value)} placeholder="Tell us your story — what drives you, why this scholarship matters, and what you hope to achieve..." />
                <p className="text-xs text-gray-400 mt-1">{form.motivationLetter.split(/\s+/).filter(Boolean).length} words</p>
              </Field>
              <Field label="Career Goals" required hint="Where do you see yourself in 3–5 years?">
                <Textarea rows={4} value={form.careerGoals} onChange={e => set("careerGoals", e.target.value)} placeholder="Describe your short-term and long-term career aspirations..." />
              </Field>
              <Field label="Availability">
                <Select value={form.availability} onValueChange={v => set("availability", v)}>
                  <SelectTrigger><SelectValue placeholder="How many hours/week can you dedicate?" /></SelectTrigger>
                  <SelectContent>
                    {["Less than 10 hours/week", "10–20 hours/week", "20–30 hours/week", "30+ hours/week (Full-time)"].map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-6">
                <CheckField
                  id="internet"
                  label="I have reliable internet access"
                  checked={form.hasInternetAccess}
                  onChange={v => set("hasInternetAccess", v)}
                />
                <CheckField
                  id="computer"
                  label="I own or have access to a personal computer"
                  checked={form.hasComputer}
                  onChange={v => set("hasComputer", v)}
                />
              </div>
            </>
          )}

          {/* Step 5: Agreements */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-amber-800 mb-1">Please read and accept all agreements below before submitting.</p>
                <p className="text-xs text-amber-700">These are binding commitments required for participation in the JOE Forge scholarship programme.</p>
              </div>

              {[
                { id: "code", field: "agreedToCodeOfConduct", label: "Code of Conduct", desc: "I agree to uphold the JOE Forge Code of Conduct, treat all community members with respect, and maintain academic integrity throughout the programme." },
                { id: "scholarship", field: "agreedToScholarshipAgreement", label: "Scholarship Agreement", desc: "I understand the scholarship obligations, including attendance requirements, assignment deadlines, and the consequences of non-compliance." },
                { id: "privacy", field: "agreedToPrivacyPolicy", label: "Privacy Policy", desc: "I consent to JOE Forge collecting and processing my personal data in accordance with the Privacy Policy for the purpose of administering the scholarship." },
                { id: "terms", field: "agreedToTerms", label: "Terms & Conditions", desc: "I have read and agree to the JOE Forge Terms and Conditions governing use of the platform and participation in the programme." },
              ].map(a => (
                <div key={a.id} className={`border rounded-xl p-5 transition-colors ${(form as any)[a.field] ? "border-primary/30 bg-primary/5" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id={a.id}
                      checked={(form as any)[a.field]}
                      onCheckedChange={v => set(a.field, !!v)}
                      className="mt-0.5"
                    />
                    <div>
                      <label htmlFor={a.id} className="font-semibold text-gray-900 cursor-pointer">{a.label}</label>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{a.desc}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Application summary */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Application Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <SummaryItem label="Name" value={form.fullName} />
                  <SummaryItem label="Email" value={form.email} />
                  <SummaryItem label="Track" value={form.preferredTrack} />
                  <SummaryItem label="Qualification" value={form.highestQualification} />
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-gray-50 border-t border-gray-100 p-8 flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            )}
            <Button variant="ghost" onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save Draft
            </Button>
          </div>

          {step < STEPS.length ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Next: {STEPS[step].title} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => saveMutation.mutate("pending")}
              disabled={!canSubmit || saveMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {saveMutation.isPending ? "Submitting…" : "Submit Application"}
              {!saveMutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-gray-700 font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function CheckField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl bg-white">
      <Checkbox id={id} checked={checked} onCheckedChange={v => onChange(!!v)} className="mt-0.5" />
      <label htmlFor={id} className="text-sm text-gray-700 leading-snug cursor-pointer">{label}</label>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <p className="font-medium text-gray-900 truncate">{value || <span className="text-gray-300 italic">Not provided</span>}</p>
    </div>
  );
}
