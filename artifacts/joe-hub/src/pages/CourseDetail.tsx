import { useParams, Link } from "wouter";
import { useGetCourse, useListCourseModules, useGetMe, useListModuleLessons } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, PlayCircle, BookOpen, Layers, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function ModuleLessons({ moduleId }: { moduleId: number }) {
  const { data: lessons, isLoading } = useListModuleLessons(moduleId);

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
                <span>Lesson {lesson.order}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
            <Link href={`/lessons/${lesson.id}`}>Watch</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function CourseDetail() {
  const params = useParams();
  const courseId = Number(params.id);
  const { data: course, isLoading: isLoadingCourse } = useGetCourse(courseId);
  const { data: modules, isLoading: isLoadingModules } = useListCourseModules(courseId);
  const { data: me } = useGetMe();

  const isStaff = me?.role === "admin" || me?.role === "mentor";

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

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-gray-900">Syllabus</h2>
        {isStaff && (
          <Button variant="outline" size="sm">Manage Modules</Button>
        )}
      </div>

      {isLoadingModules ? (
        <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : modules && modules.length > 0 ? (
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          <Accordion type="multiple" className="w-full" defaultValue={modules.slice(0, 1).map(m => `module-${m.id}`)}>
            {modules.sort((a, b) => a.order - b.order).map((module, i) => (
              <AccordionItem key={module.id} value={`module-${module.id}`} className="border-b last:border-0 border-gray-100">
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-50 hover:no-underline">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center font-display font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-lg text-gray-900">{module.title}</div>
                      <div className="text-sm text-gray-500 font-normal mt-0.5 flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        {module.lessonCount} lessons
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t border-gray-100 bg-white">
                  <ModuleLessons moduleId={module.id} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm text-gray-500">
          No modules have been added to this course yet.
        </div>
      )}
    </div>
  );
}
