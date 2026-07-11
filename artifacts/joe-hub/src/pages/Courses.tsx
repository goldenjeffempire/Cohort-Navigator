import { useListCourses } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Courses() {
  const { data: courses, isLoading } = useListCourses();

  return (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Curriculum</h1>
          <p className="text-gray-500 mt-1">Explore available courses and modules.</p>
        </div>
        {/* Admin/Mentor could have "Create Course" here, but no specific requirement so skipping unless specified */}
      </div>

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
            There are currently no courses in the curriculum.
          </p>
        </div>
      )}
    </div>
  );
}
