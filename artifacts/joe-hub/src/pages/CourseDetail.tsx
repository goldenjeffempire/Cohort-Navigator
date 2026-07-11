import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetCourse, useListCourseModules, useGetMe, useListModuleLessons,
  useCreateModule, useDeleteModule, useCreateLesson, useDeleteLesson,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, PlayCircle, BookOpen, Layers, Plus, Trash2, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListCourseModulesQueryKey, getListModuleLessonsQueryKey } from "@workspace/api-client-react";

function ModuleLessons({
  moduleId,
  isStaff,
  onLessonDeleted,
}: {
  moduleId: number;
  isStaff: boolean;
  onLessonDeleted: () => void;
}) {
  const { data: lessons, isLoading, refetch } = useListModuleLessons(moduleId);
  const deleteMutation = useDeleteLesson();
  const { toast } = useToast();

  const handleDeleteLesson = (lessonId: number, title: string) => {
    if (!confirm(`Delete lesson "${title}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: lessonId }, {
      onSuccess: () => { toast({ title: "Lesson deleted" }); refetch(); onLessonDeleted(); },
      onError: () => toast({ title: "Failed to delete lesson", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  if (!lessons || lessons.length === 0) return <div className="p-4 text-sm text-gray-500">No lessons in this module.</div>;

  return (
    <div className="divide-y divide-gray-100">
      {lessons.map((lesson) => (
        <div key={lesson.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${lesson.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              <PlayCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{lesson.title}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>Lesson {lesson.order + 1}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/lessons/${lesson.id}`}>Watch</Link>
            </Button>
            {isStaff && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteLesson(lesson.id, lesson.title)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CourseDetail() {
  const params = useParams();
  const courseId = Number(params.id);
  const { data: course, isLoading: isLoadingCourse, refetch: refetchCourse } = useGetCourse(courseId);
  const { data: modules, isLoading: isLoadingModules, refetch: refetchModules } = useListCourseModules(courseId);
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();

  const createModuleMutation = useCreateModule();
  const deleteModuleMutation = useDeleteModule();
  const createLessonMutation = useCreateLesson();

  const isStaff = me?.role === "admin" || me?.role === "mentor";

  // Add Module Dialog
  const [moduleOpen, setModuleOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleOrder, setModuleOrder] = useState("");

  const handleCreateModule = () => {
    if (!moduleTitle.trim()) { toast({ title: "Module title is required", variant: "destructive" }); return; }
    createModuleMutation.mutate({
      id: courseId,
      data: { title: moduleTitle.trim(), order: moduleOrder ? Number(moduleOrder) : (modules?.length || 0) }
    }, {
      onSuccess: () => {
        toast({ title: "Module added!" });
        setModuleOpen(false);
        setModuleTitle(""); setModuleOrder("");
        refetchModules();
        refetchCourse();
      },
      onError: () => toast({ title: "Failed to add module", variant: "destructive" }),
    });
  };

  const handleDeleteModule = (moduleId: number, title: string) => {
    if (!confirm(`Delete module "${title}" and all its lessons? This cannot be undone.`)) return;
    deleteModuleMutation.mutate({ id: moduleId }, {
      onSuccess: () => { toast({ title: "Module deleted" }); refetchModules(); refetchCourse(); },
      onError: () => toast({ title: "Failed to delete module", variant: "destructive" }),
    });
  };

  // Add Lesson Dialog
  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<number | null>(null);
  const [lessonModuleName, setLessonModuleName] = useState("");
  const [lessonForm, setLessonForm] = useState({ title: "", content: "", videoUrl: "", order: "" });
  const setLF = (f: string, v: string) => setLessonForm(prev => ({ ...prev, [f]: v }));

  const openAddLesson = (moduleId: number, moduleName: string) => {
    setLessonModuleId(moduleId);
    setLessonModuleName(moduleName);
    setLessonForm({ title: "", content: "", videoUrl: "", order: "" });
    setLessonOpen(true);
  };

  const handleCreateLesson = () => {
    if (!lessonForm.title.trim() || !lessonModuleId) { toast({ title: "Lesson title is required", variant: "destructive" }); return; }
    createLessonMutation.mutate({
      id: lessonModuleId,
      data: {
        title: lessonForm.title.trim(),
        content: lessonForm.content.trim() || undefined,
        videoUrl: lessonForm.videoUrl.trim() || undefined,
        order: lessonForm.order ? Number(lessonForm.order) : 0,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Lesson added!" });
        setLessonOpen(false);
        qc.invalidateQueries({ queryKey: getListModuleLessonsQueryKey(lessonModuleId!) });
        refetchModules();
        refetchCourse();
      },
      onError: () => toast({ title: "Failed to add lesson", variant: "destructive" }),
    });
  };

  if (isLoadingCourse) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!course) return <div className="p-8 text-center text-gray-500">Course not found.</div>;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-3 text-gray-500 hover:text-gray-900">
        <Link href="/courses">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Courses
        </Link>
      </Button>

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">Course</Badge>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Layers className="h-4 w-4" />
            <span>{course.moduleCount} modules</span>
          </div>
        </div>
        <h1 className="text-4xl font-display font-bold text-gray-900 mb-4 leading-tight">{course.title}</h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-3xl">
          {course.description || "No description provided."}
        </p>
      </div>

      {/* Add Module Dialog */}
      <Dialog open={moduleOpen} onOpenChange={setModuleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Module</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Module Title *</Label>
              <Input placeholder="e.g. Introduction to React Hooks" value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Order</Label>
              <Input type="number" placeholder={`e.g. ${(modules?.length || 0) + 1}`} value={moduleOrder} onChange={e => setModuleOrder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateModule} disabled={createModuleMutation.isPending}>
              {createModuleMutation.isPending ? "Adding..." : "Add Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lesson Dialog */}
      <Dialog open={lessonOpen} onOpenChange={setLessonOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lesson to "{lessonModuleName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Lesson Title *</Label>
              <Input placeholder="e.g. useState and useEffect Hooks" value={lessonForm.title} onChange={e => setLF("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea rows={4} placeholder="Lesson description, key concepts, notes..." value={lessonForm.content} onChange={e => setLF("content", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input placeholder="https://youtube.com/watch?v=..." value={lessonForm.videoUrl} onChange={e => setLF("videoUrl", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Order</Label>
              <Input type="number" placeholder="0" value={lessonForm.order} onChange={e => setLF("order", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLesson} disabled={createLessonMutation.isPending}>
              {createLessonMutation.isPending ? "Adding..." : "Add Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-gray-900">Syllabus</h2>
        {isStaff && (
          <Button variant="outline" size="sm" onClick={() => setModuleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Module
          </Button>
        )}
      </div>

      {isLoadingModules ? (
        <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : modules && modules.length > 0 ? (
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          <Accordion type="multiple" className="w-full" defaultValue={modules.slice(0, 1).map(m => `module-${m.id}`)}>
            {modules.sort((a, b) => a.order - b.order).map((module, i) => (
              <AccordionItem key={module.id} value={`module-${module.id}`} className="border-b last:border-0 border-gray-100">
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-50 hover:no-underline group">
                  <div className="flex items-center gap-4 text-left flex-1">
                    <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center font-display font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg text-gray-900">{module.title}</div>
                      <div className="text-sm text-gray-500 font-normal mt-0.5 flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        {module.lessonCount} lessons
                      </div>
                    </div>
                    {isStaff && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-4" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openAddLesson(module.id, module.title)}>
                          <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add Lesson
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteModule(module.id, module.title)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t border-gray-100 bg-white">
                  <ModuleLessons
                    moduleId={module.id}
                    isStaff={isStaff}
                    onLessonDeleted={() => refetchModules()}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm text-gray-500">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="mb-4">No modules have been added to this course yet.</p>
          {isStaff && (
            <Button onClick={() => setModuleOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add First Module
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
