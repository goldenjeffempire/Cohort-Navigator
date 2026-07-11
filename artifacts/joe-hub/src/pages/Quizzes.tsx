import { useState } from "react";
import { useListQuizzes, useGetMe, useCreateQuiz, useListCourses } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, FileQuestion, ChevronRight, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Quizzes() {
  const { data: quizzes, isLoading, refetch } = useListQuizzes();
  const { data: me } = useGetMe();
  const { data: courses } = useListCourses();
  const createMutation = useCreateQuiz();
  const { toast } = useToast();

  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    courseId: "", title: "", description: "", timeLimitMinutes: "",
  });
  const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  const handleCreate = () => {
    if (!form.courseId || !form.title.trim()) {
      toast({ title: "Course and title are required.", variant: "destructive" }); return;
    }
    createMutation.mutate({
      data: {
        courseId: Number(form.courseId),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : undefined,
      }
    }, {
      onSuccess: (quiz) => {
        toast({ title: "Quiz created! Add questions to it now." });
        setOpen(false);
        setForm({ courseId: "", title: "", description: "", timeLimitMinutes: "" });
        refetch();
      },
      onError: () => toast({ title: "Failed to create quiz", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Quizzes</h1>
          <p className="text-gray-500 mt-1">Test your knowledge and earn points.</p>
        </div>
        {isStaff && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Quiz
          </Button>
        )}
      </div>

      {/* Create Quiz Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={form.courseId} onValueChange={v => set("courseId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quiz Title *</Label>
              <Input placeholder="e.g. JavaScript Fundamentals Quiz" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} placeholder="Brief overview of what's covered..." value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time Limit (minutes)</Label>
              <Input type="number" placeholder="Leave blank for no limit" value={form.timeLimitMinutes} onChange={e => set("timeLimitMinutes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-2/3 mb-4"/><Skeleton className="h-4 w-full"/></CardContent></Card>
          ))}
        </div>
      ) : quizzes && quizzes.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map(quiz => (
            <Card key={quiz.id} className="shadow-sm border-gray-100 hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-display line-clamp-2">{quiz.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-gray-500 mb-6 line-clamp-3">
                  {quiz.description || "No description."}
                </p>
                <div className="flex flex-col gap-2 text-sm text-gray-600 font-medium">
                   <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-md">
                     <FileQuestion className="h-4 w-4 text-primary" />
                     {quiz.questionCount} Questions
                   </div>
                   <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-md">
                     <Clock className="h-4 w-4 text-primary" />
                     {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} Minutes` : 'No time limit'}
                   </div>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-gray-50 bg-gray-50/50">
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/quizzes/${quiz.id}`}>
                    {isStaff ? "Manage Quiz" : "Open Quiz"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No quizzes available</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {isStaff ? 'Create the first quiz to start testing students.' : 'Check back later for knowledge checks.'}
          </p>
          {isStaff && (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Quiz
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
