import { useParams, Link } from "wouter";
import { useGetCohort, useListCohortEnrollments, useListCohortMentors, useListCohortCourses, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Users, BookOpen, GraduationCap, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function CohortDetail() {
  const params = useParams();
  const cohortId = Number(params.id);
  const { data: me } = useGetMe();
  
  const { data: cohort, isLoading: isLoadingCohort } = useGetCohort(cohortId);
  const { data: enrollments, isLoading: isLoadingEnrollments } = useListCohortEnrollments(cohortId);
  const { data: mentors, isLoading: isLoadingMentors } = useListCohortMentors(cohortId);
  const { data: courses, isLoading: isLoadingCourses } = useListCohortCourses(cohortId);

  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  if (isLoadingCohort) {
    return <div className="p-8 space-y-6 max-w-6xl mx-auto"><Skeleton className="h-8 w-24" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cohort) return <div className="p-8 text-center text-gray-500">Cohort not found.</div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-3 text-gray-500">
        <Link href="/cohorts">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Cohorts
        </Link>
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="uppercase tracking-wider">{cohort.status}</Badge>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(cohort.startDate), "MMM d, yyyy")} 
              {cohort.endDate && ` - ${format(new Date(cohort.endDate), "MMM d, yyyy")}`}
            </span>
          </div>
          <h1 className="text-4xl font-display font-bold text-gray-900">{cohort.name}</h1>
        </div>
        {me?.role === 'admin' && (
          <Button variant="outline">Edit Cohort</Button>
        )}
      </div>

      <p className="text-lg text-gray-600 max-w-3xl mb-10 leading-relaxed">
        {cohort.description || "No description provided for this cohort."}
      </p>

      <Tabs defaultValue="roster" className="w-full">
        <TabsList className="mb-8 w-full justify-start h-auto p-1 bg-gray-100/50 rounded-xl">
          <TabsTrigger value="roster" className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-2" /> Roster
          </TabsTrigger>
          <TabsTrigger value="path" className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BookOpen className="h-4 w-4 mr-2" /> Learning Path
          </TabsTrigger>
          <TabsTrigger value="mentors" className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <GraduationCap className="h-4 w-4 mr-2" /> Mentors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold">Students ({enrollments?.length || 0})</h3>
            {me?.role === 'admin' && <Button size="sm">Enroll Student</Button>}
          </div>
          
          {isLoadingEnrollments ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : enrollments && enrollments.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollments.map(enr => (
                <div key={enr.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                  <Avatar className="h-10 w-10 border border-gray-100">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">{enr.studentName.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{enr.studentName}</div>
                    <div className="text-xs text-gray-500 truncate">{enr.studentEmail}</div>
                  </div>
                  <Badge variant={enr.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase">{enr.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
              No students enrolled yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="path" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold">Curriculum Roadmap</h3>
            {me?.role === 'admin' && <Button size="sm">Add Course</Button>}
          </div>

          {isLoadingCourses ? (
             <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
          ) : courses && courses.length > 0 ? (
            <div className="space-y-3 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {courses.sort((a, b) => a.order - b.order).map((c, i) => (
                <div key={c.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white bg-gray-100 text-gray-400 group-hover:bg-primary group-hover:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 transition-colors">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Phase {i + 1}</div>
                    <div className="font-bold text-gray-900 mb-2">{c.courseTitle}</div>
                    <Button variant="link" size="sm" className="px-0 h-auto" asChild>
                       <Link href={`/courses/${c.courseId}`}>View Course Modules</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
              No courses assigned to this cohort's learning path.
            </div>
          )}
        </TabsContent>

        <TabsContent value="mentors" className="space-y-4">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold">Assigned Mentors</h3>
            {me?.role === 'admin' && <Button size="sm">Assign Mentor</Button>}
          </div>

          {isLoadingMentors ? (
            <div className="grid md:grid-cols-3 gap-4"><Skeleton className="h-32 w-full" /></div>
          ) : mentors && mentors.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {mentors.map(m => (
                <Card key={m.id} className="border-gray-100 shadow-sm text-center p-6">
                  <Avatar className="h-16 w-16 mx-auto mb-4 border-2 border-gray-50">
                    <AvatarFallback className="bg-orange-100 text-orange-700 text-xl">{m.mentorName.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="font-bold text-gray-900">{m.mentorName}</div>
                  <div className="text-sm text-gray-500 mb-4">{m.mentorEmail}</div>
                  <Badge variant="secondary">Mentor</Badge>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
              No mentors assigned yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
