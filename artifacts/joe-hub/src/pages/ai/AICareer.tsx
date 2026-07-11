/**
 * AI Career Center — resume review, portfolio analysis, and career roadmap.
 */
import { useState } from "react";
import { streamAITool } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, MapPin, FileText, Github, Linkedin, TrendingUp, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

const LEVELS = ["junior", "mid-level", "senior", "staff"];
const ROLES = ["Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Engineer", "DevOps Engineer", "ML Engineer", "Mobile Developer", "QA Engineer", "Software Architect"];

function StreamingCard({ title, text, loading, icon: Icon }: { title: string; text: string; loading: boolean; icon: typeof Briefcase }) {
  if (!text && !loading) return null;
  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown>{text}</ReactMarkdown>
          {loading && <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse rounded-sm ml-0.5" />}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AICareer() {
  const [tab, setTab] = useState("resume");
  const [resume, setResume] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [targetRole, setTargetRole] = useState(ROLES[2]);
  const [level, setLevel] = useState("junior");
  const [analysisText, setAnalysisText] = useState("");
  const [loading, setLoading] = useState(false);

  const [pathGoal, setPathGoal] = useState(ROLES[2]);
  const [pathWeeks, setPathWeeks] = useState("12");
  const [pathSkills, setPathSkills] = useState("");
  const [pathText, setPathText] = useState("");
  const [pathLoading, setPathLoading] = useState(false);

  const analyzeProfile = async () => {
    if (!resume.trim() && !githubUrl.trim()) return;
    setLoading(true);
    setAnalysisText("");
    await streamAITool("/ai/career/analyze", {
      resumeText: resume || undefined,
      githubUrl: githubUrl || undefined,
      linkedinUrl: linkedinUrl || undefined,
      targetRole, currentLevel: level,
    }, {
      onChunk: (c) => setAnalysisText((p) => p + c),
      onDone: () => setLoading(false),
      onError: () => setLoading(false),
    });
  };

  const generatePath = async () => {
    setPathLoading(true);
    setPathText("");
    const skills = pathSkills.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/ai/learning/path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalRole: pathGoal, timelineWeeks: parseInt(pathWeeks), currentSkills: skills }),
    });
    if (!res.ok || !res.body) { setPathLoading(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.content) setPathText((p) => p + d.content);
          if (d.done) { setPathLoading(false); return; }
        } catch { /* skip */ }
      }
    }
    setPathLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-rose-600 to-pink-700 p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="h-5 w-5" />
          <span className="text-sm font-medium opacity-80">AI Career Assistant</span>
        </div>
        <h1 className="text-2xl font-display font-bold">Career Center</h1>
        <p className="text-white/80 text-sm mt-1">Resume analysis, portfolio review, and AI-generated personalised career roadmaps.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resume">Profile Analysis</TabsTrigger>
          <TabsTrigger value="path">Learning Roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Profile Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Target Role</label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Current Level</label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger className="h-9 text-sm capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Github className="h-3.5 w-3.5" /> GitHub URL (optional)</label>
                <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/yourusername" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Linkedin className="h-3.5 w-3.5" /> LinkedIn URL (optional)</label>
                <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Resume / CV (paste text)</label>
                <Textarea value={resume} onChange={(e) => setResume(e.target.value)}
                  placeholder="Paste your resume text here — work experience, skills, education, projects…"
                  className="min-h-32 text-sm" />
              </div>
              <Button className="w-full" onClick={analyzeProfile} disabled={(!resume.trim() && !githubUrl.trim()) || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                {loading ? "Analysing your profile…" : "Analyse Career Profile"}
              </Button>
            </CardContent>
          </Card>

          <StreamingCard title="Career Profile Analysis" text={analysisText} loading={loading} icon={Briefcase} />
        </TabsContent>

        <TabsContent value="path" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Learning Path Generator</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Goal Role</label>
                  <Select value={pathGoal} onValueChange={setPathGoal}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Timeline (weeks)</label>
                  <Select value={pathWeeks} onValueChange={setPathWeeks}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["8", "12", "16", "24", "52"].map((w) => <SelectItem key={w} value={w}>{w} weeks</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Current Skills (comma separated)</label>
                <Input value={pathSkills} onChange={(e) => setPathSkills(e.target.value)} placeholder="e.g. HTML, CSS, JavaScript basics" className="h-9 text-sm" />
              </div>
              <Button className="w-full" onClick={generatePath} disabled={pathLoading}>
                {pathLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                {pathLoading ? "Building roadmap…" : "Generate Learning Roadmap"}
              </Button>
            </CardContent>
          </Card>

          <StreamingCard title="Your Personalised Learning Roadmap" text={pathText} loading={pathLoading} icon={TrendingUp} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
