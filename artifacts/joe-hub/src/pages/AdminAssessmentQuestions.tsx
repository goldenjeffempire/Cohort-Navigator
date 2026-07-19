import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CheckCircle, GripVertical, HelpCircle } from "lucide-react";

type Option = { id: string; text: string };
type Question = {
  id: number;
  question: string;
  options: Option[];
  correct_option_id: string;
  explanation?: string;
  points: number;
  order_index: number;
  is_active: boolean;
};

const OPTION_LABELS = ["a", "b", "c", "d", "e"];

const emptyForm = () => ({
  question: "",
  options: [
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ] as Option[],
  correctOptionId: "a",
  explanation: "",
  points: 1,
  orderIndex: 0,
  isActive: true,
});

export default function AdminAssessmentQuestions() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: questions, isLoading } = useQuery({
    queryKey: ["/api/admin/assessment-questions"],
    queryFn: () => customFetch<Question[]>("/api/admin/assessment-questions"),
  });

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; question?: Question } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => customFetch<Question>("/api/admin/assessment-questions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Question created" }); qc.invalidateQueries({ queryKey: ["/api/admin/assessment-questions"] }); setDialog(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      customFetch<Question>(`/api/admin/assessment-questions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Question updated" }); qc.invalidateQueries({ queryKey: ["/api/admin/assessment-questions"] }); setDialog(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/assessment-questions/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Question deleted" }); qc.invalidateQueries({ queryKey: ["/api/admin/assessment-questions"] }); setDeleteId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setForm({ ...emptyForm(), orderIndex: (questions?.length ?? 0) });
    setDialog({ mode: "create" });
  };

  const openEdit = (q: Question) => {
    setForm({
      question: q.question,
      options: q.options,
      correctOptionId: q.correct_option_id,
      explanation: q.explanation ?? "",
      points: q.points,
      orderIndex: q.order_index,
      isActive: q.is_active,
    });
    setDialog({ mode: "edit", question: q });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      question: form.question,
      options: form.options.filter(o => o.text.trim()),
      correctOptionId: form.correctOptionId,
      explanation: form.explanation || undefined,
      points: form.points,
      orderIndex: form.orderIndex,
      isActive: form.isActive,
    };
    if (dialog?.mode === "edit" && dialog.question) {
      updateMutation.mutate({ id: dialog.question.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const setOption = (idx: number, text: string) => {
    setForm(f => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, text } : o) }));
  };

  const addOption = () => {
    if (form.options.length >= 5) return;
    const newId = OPTION_LABELS[form.options.length];
    setForm(f => ({ ...f, options: [...f.options, { id: newId, text: "" }] }));
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) return;
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  };

  const active = questions?.filter(q => q.is_active) ?? [];
  const inactive = questions?.filter(q => !q.is_active) ?? [];
  const totalPoints = active.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Assessment Questions</h1>
          <p className="text-gray-500 mt-1">Manage the probation admission assessment question bank.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Question
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Questions" value={active.length} color="text-green-600" />
        <StatCard label="Total Points" value={totalPoints} color="text-primary" />
        <StatCard label="Pass Score" value="70%" color="text-indigo-600" />
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : (questions?.length ?? 0) === 0 ? (
        <div className="text-center p-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700 mb-2">No questions yet</h3>
          <p className="text-gray-400 text-sm mb-6">Add multiple-choice questions to the assessment.</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Create First Question</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active ({active.length})</h2>
              <div className="space-y-3">
                {active.map((q, idx) => (
                  <QuestionCard key={q.id} q={q} index={idx} onEdit={() => openEdit(q)} onDelete={() => setDeleteId(q.id)} />
                ))}
              </div>
            </section>
          )}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Inactive ({inactive.length})</h2>
              <div className="space-y-3 opacity-60">
                {inactive.map((q, idx) => (
                  <QuestionCard key={q.id} q={q} index={idx} onEdit={() => openEdit(q)} onDelete={() => setDeleteId(q.id)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={!!dialog} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Question" : "New Question"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Question <span className="text-red-500">*</span></Label>
              <Textarea rows={3} required value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="Enter the question text..." />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Answer Options <span className="text-red-500">*</span></Label>
                {form.options.length < 5 && (
                  <Button type="button" size="sm" variant="ghost" onClick={addOption}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add option
                  </Button>
                )}
              </div>
              {form.options.map((opt, idx) => (
                <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${form.correctOptionId === opt.id ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, correctOptionId: opt.id }))}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 font-bold text-xs transition-colors ${form.correctOptionId === opt.id ? "bg-green-500 border-green-500 text-white" : "border-gray-300 text-gray-400 hover:border-green-400"}`}
                    title="Mark as correct answer"
                  >
                    {form.correctOptionId === opt.id ? <CheckCircle className="h-4 w-4" /> : opt.id.toUpperCase()}
                  </button>
                  <Input
                    value={opt.text}
                    onChange={e => setOption(idx, e.target.value)}
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                    className="flex-1"
                  />
                  {form.options.length > 2 && (
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeOption(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-400">Click the circle to mark the correct answer (shown in green).</p>
            </div>

            <div className="space-y-2">
              <Label>Explanation (shown after completion)</Label>
              <Textarea rows={2} value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Optional: explain why the answer is correct..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points</Label>
                <Input type="number" min={1} max={10} value={form.points} onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-2">
                <Label>Order</Label>
                <Input type="number" min={0} value={form.orderIndex} onChange={e => setForm(f => ({ ...f, orderIndex: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
              <Switch id="active-sw" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <label htmlFor="active-sw" className="text-sm font-medium cursor-pointer">Active (included in assessment)</label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Saving…" : dialog?.mode === "edit" ? "Save Changes" : "Create Question"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Question?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">This will permanently remove the question from the bank. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionCard({ q, index, onEdit, onDelete }: { q: Question; index: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <GripVertical className="h-5 w-5 text-gray-300 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium">Q{index + 1}</span>
                <Badge variant="outline" className="text-xs">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                {!q.is_active && <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-3 leading-relaxed">{q.question}</p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map(opt => (
                <div key={opt.id} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${opt.id === q.correct_option_id ? "bg-green-100 text-green-700 font-medium" : "bg-gray-50 text-gray-500"}`}>
                  {opt.id === q.correct_option_id && <CheckCircle className="h-3 w-3 flex-shrink-0" />}
                  <span className="uppercase font-bold mr-1">{opt.id}.</span> {opt.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card className="border-gray-100 shadow-sm">
      <CardContent className="p-5 text-center">
        <p className={`text-3xl font-bold font-display ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
