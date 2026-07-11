import { useState } from "react";
import { useListCourses, useGetMe, useCreateCourse } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, Layers, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Courses() {
  const { data: courses, isLoading, refetch } = useListCourses();
  const { data: me } = useGetMe();
  const createMutation = useCreateCourse();
  const { toast } = useToast();

  const isAdmin = me?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", thumbnailUrl: "" });
  const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  const handleCreate = () => {
    if (!form.title.trim()) {
      toast({ title: "Course title is required.", variant: "destructive" }); return;
    }
    createMutation.mutate({
      data: {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Course created!" });
        setOpen(false);
        setForm({ title: "", description: "", thumbnailUrl: "" });
        refetch();
      },
      onError: () => toast({ title: "Failed to create course", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Curriculum</h1>
          <p className="text-gray-500 mt-1">Explore available courses and modules.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Course
          </Button>
        )}
      </div>

      {/* Create Course Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="course-title">Title *</Label>
              <Input id="course-title" placeholder="e.g. Advanced Backend Development" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-desc">Description</Label>
              <Textarea id="course-desc" placeholder="Brief overview of what students will learn..." rows={4} value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-thumb">Thumbnail URL</Label>
              <Input id="course-thumb" placeholder="https://images.unsplash.com/..." value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} />
              <p className="text-xs text-gray-500">Link to a cover image for this course (optional).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Card key={i} className="shadow-sm border-gray-100">
              <div className="h-40 bg-gray-100" />
              <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map(course => (
            <Card key={course.id} className="shadow-sm border-gray-100 hover:shadow-md transition-shadow flex flex-col overflow-hidden group">
              <div className="h-40 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <BookOpen className="h-12 w-12 text-gray-300" />
                )}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur border border-white/20 rounded-md px-2 py-1 text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {course.moduleCount} modules
                </div>
              </div>
              <CardHeader className="pb-3 flex-none">
                <CardTitle className="font-display line-clamp-1">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-gray-500 line-clamp-3">
                  {course.description || "No description provided."}
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-gray-50">
                <Button className="w-full" asChild>
                  <Link href={`/courses/${course.id}`}>
                    View Course Content
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses available</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {isAdmin ? 'Get started by creating the first course.' : 'There are currently no courses in the curriculum.'}
          </p>
          {isAdmin && (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create First Course
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
