import { useState } from "react";
import { Link } from "wouter";
import { useGetMe, useListCourses } from "@workspace/api-client-react";
import {
  useListChallenges,
  useCreateChallenge,
  useUpdateChallenge,
  useDeleteChallenge,
  useAddTestCase,
  useDeleteTestCase,
  useListChallengeTestCases,
  useListAllSubmissions,
  useRunPlagiarismCheck,
  useGetPlagiarismReports,
  type CodingChallenge,
  type ChallengeTestCase,
} from "@/lib/coding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Edit, Eye, EyeOff, Code2, TestTube, FlaskConical,
  Users, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Difficulty / difficulty helpers ─────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  passed: "text-green-600",
  partial: "text-yellow-600",
  failed: "text-red-600",
  error: "text-red-600",
  timeout: "text-orange-600",
};

// ─── Challenge form ───────────────────────────────────────────────────────────

interface ChallengeFormState {
  title: string;
  description: string;
  instructions: string;
  difficulty: string;
  type: string;
  language: string;
  starterCode: string;
  solutionCode: string;
  courseId: string;
  maxAttempts: string;
  timeLimitMs: string;
  points: string;
  isPublished: boolean;
  tags: string;
}

const defaultForm = (): ChallengeFormState => ({
  title: "", description: "", instructions: "", difficulty: "easy",
  type: "practice", language: "javascript", starterCode: "", solutionCode: "",
  courseId: "", maxAttempts: "", timeLimitMs: "10000", points: "100",
  isPublished: false, tags: "",
});

// ─── Test case form ───────────────────────────────────────────────────────────

interface TestCaseFormState {
  input: string;
  expectedOutput: string;
  description: string;
  isHidden: boolean;
  points: string;
}

// ─── Plagiarism report section ────────────────────────────────────────────────

function PlagiarismSection({ challengeId }: { challengeId: number }) {
  const { data: reports, isLoading } = useGetPlagiarismReports(challengeId);
  const runMutation = useRunPlagiarismCheck();
  const { toast } = useToast();

  const handleRun = () => {
    runMutation.mutate(challengeId, {
      onSuccess: (r) => toast({ title: r.message }),
      onError: () => toast({ title: "Failed to run plagiarism check", variant: "destructive" }),
    });
  };

  const flagged = reports?.filter((r) => r.flagged) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Detects similar submissions using token-based Jaccard similarity (≥70% flags as suspect).
        </p>
        <Button size="sm" variant="outline" onClick={handleRun} disabled={runMutation.isPending}>
          {runMutation.isPending ? "Analyzing…" : "Run Analysis"}
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-32" /> : (
        reports && reports.length > 0 ? (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg border ${r.flagged ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {r.flagged
                      ? <AlertTriangle className="h-4 w-4 text-red-500" />
                      : <CheckCircle2 className="h-4 w-4 text-green-500" />
                    }
                    {r.student1Name} ↔ {r.student2Name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Similarity: {Math.round(r.similarityScore * 100)}%</div>
                </div>
                <Badge variant={r.flagged ? "destructive" : "secondary"}>
                  {r.flagged ? "Flagged" : "Clear"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
            No analysis run yet. Click "Run Analysis" to compare submissions.
          </div>
        )
      )}
    </div>
  );
}

// ─── Test cases section ───────────────────────────────────────────────────────

function TestCasesSection({ challengeId }: { challengeId: number }) {
  const { data: testCases, refetch } = useListChallengeTestCases(challengeId);
  const addMutation = useAddTestCase();
  const deleteMutation = useDeleteTestCase();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<TestCaseFormState>({
    input: "", expectedOutput: "", description: "", isHidden: false, points: "10",
  });

  const handleAdd = () => {
    if (!form.expectedOutput.trim()) { toast({ title: "Expected output is required", variant: "destructive" }); return; }
    addMutation.mutate({
      challengeId,
      data: {
        input: form.input,
        expectedOutput: form.expectedOutput,
        description: form.description || undefined,
        isHidden: form.isHidden,
        points: parseInt(form.points) || 10,
      },
    }, {
      onSuccess: () => { toast({ title: "Test case added!" }); setAddOpen(false); setForm({ input: "", expectedOutput: "", description: "", isHidden: false, points: "10" }); },
      onError: () => toast({ title: "Failed to add test case", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this test case?")) return;
    deleteMutation.mutate({ id, challengeId }, {
      onSuccess: () => toast({ title: "Test case deleted" }),
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {testCases?.filter(t => !t.isHidden).length ?? 0} public · {testCases?.filter(t => t.isHidden).length ?? 0} hidden
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Test Case
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Test Case</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Input placeholder="e.g. Basic case — empty input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Input (stdin)</Label>
              <Textarea className="font-mono text-sm" rows={3} placeholder="Input for this test case…" value={form.input} onChange={e => setForm(f => ({ ...f, input: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expected Output *</Label>
              <Textarea className="font-mono text-sm" rows={3} placeholder="Expected stdout output…" value={form.expectedOutput} onChange={e => setForm(f => ({ ...f, expectedOutput: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Points</Label>
                <Input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.isHidden} onCheckedChange={v => setForm(f => ({ ...f, isHidden: v }))} id="tc-hidden" />
                <Label htmlFor="tc-hidden" className="text-sm cursor-pointer">Hidden test</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!testCases?.length ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
          No test cases yet. Add some to enable automatic grading.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {testCases.map((tc, i) => (
            <div key={tc.id} className="p-4 flex items-start gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
                  {tc.isHidden && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Hidden</Badge>
                  )}
                  {tc.description && <span className="text-xs text-gray-600">{tc.description}</span>}
                  <span className="ml-auto text-xs text-gray-400">{tc.points} pts</span>
                </div>
                {tc.input && (
                  <pre className="text-xs font-mono bg-gray-50 rounded p-1.5 mb-1.5 text-gray-600 max-h-12 overflow-y-auto">{tc.input}</pre>
                )}
                <pre className="text-xs font-mono bg-green-50 rounded p-1.5 text-green-700 max-h-12 overflow-y-auto">{tc.expectedOutput}</pre>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 shrink-0"
                onClick={() => handleDelete(tc.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Challenge row ────────────────────────────────────────────────────────────

function ChallengeRow({
  challenge,
  onEdit,
  onDelete,
  onManage,
}: {
  challenge: CodingChallenge;
  onEdit: (c: CodingChallenge) => void;
  onDelete: (id: number) => void;
  onManage: (c: CodingChallenge) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-medium text-gray-900 text-sm">{challenge.title}</span>
          <Badge variant="outline" className={`text-xs capitalize ${DIFFICULTY_COLORS[challenge.difficulty]}`}>
            {challenge.difficulty}
          </Badge>
          <Badge variant="secondary" className="text-xs capitalize">{challenge.language}</Badge>
          {!challenge.isPublished && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Draft</Badge>
          )}
        </div>
        <div className="text-xs text-gray-400">{challenge.points} pts · {challenge.type}</div>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onManage(challenge)}>
          <TestTube className="mr-1 h-3.5 w-3.5" /> Manage
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(challenge)}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => onDelete(challenge.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminChallenges() {
  const { data: challenges, isLoading, refetch } = useListChallenges({ all: true });
  const { data: courses } = useListCourses();
  const createMutation = useCreateChallenge();
  const updateMutation = useUpdateChallenge();
  const deleteMutation = useDeleteChallenge();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editChallenge, setEditChallenge] = useState<CodingChallenge | null>(null);
  const [manageChallenge, setManageChallenge] = useState<CodingChallenge | null>(null);
  const [form, setForm] = useState<ChallengeFormState>(defaultForm());

  const setF = (k: keyof ChallengeFormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(defaultForm()); setCreateOpen(true); };
  const openEdit = (c: CodingChallenge) => {
    setEditChallenge(c);
    setForm({
      title: c.title, description: c.description, instructions: c.instructions ?? "",
      difficulty: c.difficulty, type: c.type, language: c.language,
      starterCode: c.starterCode ?? "", solutionCode: c.solutionCode ?? "",
      courseId: c.courseId ? String(c.courseId) : "", maxAttempts: c.maxAttempts ? String(c.maxAttempts) : "",
      timeLimitMs: String(c.timeLimitMs), points: String(c.points),
      isPublished: c.isPublished, tags: c.tags ?? "",
    });
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.description.trim() || !form.language) {
      toast({ title: "Title, description, and language are required", variant: "destructive" }); return;
    }
    const data = {
      title: form.title.trim(), description: form.description.trim(),
      instructions: form.instructions.trim() || undefined,
      difficulty: form.difficulty as any, type: form.type as any, language: form.language as any,
      starterCode: form.starterCode || undefined, solutionCode: form.solutionCode || undefined,
      courseId: form.courseId ? Number(form.courseId) : undefined,
      maxAttempts: form.maxAttempts ? Number(form.maxAttempts) : undefined,
      timeLimitMs: Number(form.timeLimitMs) || 10000,
      points: Number(form.points) || 100,
      isPublished: form.isPublished,
      tags: form.tags || undefined,
    };

    if (editChallenge) {
      updateMutation.mutate({ id: editChallenge.id, data }, {
        onSuccess: () => { toast({ title: "Challenge updated!" }); setEditChallenge(null); refetch(); },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => { toast({ title: "Challenge created!" }); setCreateOpen(false); refetch(); },
        onError: () => toast({ title: "Failed to create", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this challenge and all its submissions? This cannot be undone.")) return;
    deleteMutation.mutate(id, {
      onSuccess: () => { toast({ title: "Challenge deleted" }); refetch(); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const ChallengeFormDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editChallenge ? "Edit Challenge" : "Create Challenge"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="e.g. Reverse a String" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description *</Label>
              <Textarea rows={3} value={form.description} onChange={e => setF("description", e.target.value)} placeholder="What should the student implement?" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Instructions (detailed)</Label>
              <Textarea rows={4} value={form.instructions} onChange={e => setF("instructions", e.target.value)} placeholder="Constraints, examples, hints…" />
            </div>
            <div className="space-y-1">
              <Label>Language *</Label>
              <Select value={form.language} onValueChange={v => setF("language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["javascript","typescript","python","bash","html","css","sql"].map(l => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={v => setF("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setF("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="assessment">Assessment</SelectItem>
                  <SelectItem value="capstone">Capstone</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Course (optional)</Label>
              <Select value={form.courseId} onValueChange={v => setF("courseId", v)}>
                <SelectTrigger><SelectValue placeholder="No course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No course</SelectItem>
                  {courses?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Starter Code</Label>
              <Textarea className="font-mono text-xs" rows={5} value={form.starterCode} onChange={e => setF("starterCode", e.target.value)} placeholder="Code students start with…" />
            </div>
            <div className="space-y-1">
              <Label>Time Limit (ms)</Label>
              <Input type="number" value={form.timeLimitMs} onChange={e => setF("timeLimitMs", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Points</Label>
              <Input type="number" value={form.points} onChange={e => setF("points", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max Attempts</Label>
              <Input type="number" value={form.maxAttempts} onChange={e => setF("maxAttempts", e.target.value)} placeholder="Unlimited" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={form.isPublished} onCheckedChange={v => setF("isPublished", v)} id="pub-switch" />
              <Label htmlFor="pub-switch" className="cursor-pointer">Published (visible to students)</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {editChallenge ? "Save Changes" : "Create Challenge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Manage Challenges</h1>
          <p className="text-gray-500 mt-1">Create and configure coding challenges with test cases.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Challenge
        </Button>
      </div>

      <ChallengeFormDialog open={createOpen || !!editChallenge} onClose={() => { setCreateOpen(false); setEditChallenge(null); }} />

      {/* Manage challenge modal (test cases + plagiarism) */}
      <Dialog open={!!manageChallenge} onOpenChange={(v) => { if (!v) setManageChallenge(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate">{manageChallenge?.title}</DialogTitle>
          </DialogHeader>
          {manageChallenge && (
            <Tabs defaultValue="testcases">
              <TabsList className="mb-4">
                <TabsTrigger value="testcases"><TestTube className="mr-1.5 h-3.5 w-3.5" /> Test Cases</TabsTrigger>
                <TabsTrigger value="plagiarism"><FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Plagiarism</TabsTrigger>
                <TabsTrigger value="view" asChild>
                  <Link href={`/challenges/${manageChallenge.id}`}>
                    <Code2 className="mr-1.5 h-3.5 w-3.5" /> Open
                  </Link>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="testcases">
                <TestCasesSection challengeId={manageChallenge.id} />
              </TabsContent>
              <TabsContent value="plagiarism">
                <PlagiarismSection challengeId={manageChallenge.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Challenge list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : challenges && challenges.length > 0 ? (
        <Card className="shadow-sm border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {challenges.map((c) => (
              <ChallengeRow key={c.id} challenge={c} onEdit={openEdit} onDelete={handleDelete} onManage={setManageChallenge} />
            ))}
          </div>
        </Card>
      ) : (
        <div className="text-center p-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Code2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No challenges yet</h3>
          <Button className="mt-2" onClick={openCreate}>Create First Challenge</Button>
        </div>
      )}
    </div>
  );
}
