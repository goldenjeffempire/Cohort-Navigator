import { useGetMe, useGetStudentDashboard, useGetMentorDashboard, useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, BookOpen, Users, AlertCircle, FileText, CheckCircle, ChevronRight, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function StudentDashboard() {
  const { data: dashboard, isLoading } = useGetStudentDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Overall Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.progressPercent}%</div>
            <Progress value={dashboard.progressPercent} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Cohort</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-display line-clamp-1">
              {dashboard.currentCohort ? dashboard.currentCohort.name : "Not Enrolled"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard.currentCohort ? `${format(new Date(dashboard.currentCohort.startDate), "MMM d, yyyy")}` : "Awaiting assignment"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Upcoming Assignments</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.upcomingAssignments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Due in next 7 days</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Unread Notifications</CardTitle>
            <AlertCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.unreadNotificationCount}</div>
            <Button variant="link" size="sm" className="px-0 mt-1 h-auto text-xs" asChild>
              <Link href="/notifications">View all</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-gray-100 flex flex-col">
          <CardHeader>
            <CardTitle className="font-display">Enrolled Courses</CardTitle>
            <CardDescription>Courses in your active learning path</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {dashboard.enrolledCourses.length > 0 ? (
              <div className="space-y-4">
                {dashboard.enrolledCourses.map(course => (
                  <div key={course.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary/20 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-medium">{course.title}</span>
                      <span className="text-xs text-muted-foreground">{course.moduleCount} modules</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/courses/${course.id}`}>
                        Resume
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <BookOpen className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">You are not enrolled in any courses yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100 flex flex-col">
          <CardHeader>
            <CardTitle className="font-display">Recent Announcements</CardTitle>
            <CardDescription>Updates from JOE Forge and mentors</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {dashboard.recentAnnouncements.length > 0 ? (
              <div className="space-y-4">
                {dashboard.recentAnnouncements.slice(0, 3).map(ann => (
                  <div key={ann.id} className="flex flex-col p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{ann.title}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(ann.createdAt), "MMM d")}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{ann.body}</p>
                  </div>
                ))}
                {dashboard.recentAnnouncements.length > 3 && (
                  <Button variant="link" className="w-full" asChild>
                    <Link href="/announcements">View all announcements</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No new announcements.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MentorDashboard() {
  const { data: dashboard, isLoading } = useGetMentorDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Assigned Cohorts</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.assignedCohorts.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Mentored Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.studentCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Submissions</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.pendingSubmissionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting grading</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Actions</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" className="w-full mt-2" asChild>
              <Link href="/assignments">Grade Submissions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Mentor recent submissions etc */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="font-display">Recent Submissions</CardTitle>
          <CardDescription>Latest assignment submissions from your cohorts</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard.recentSubmissions.length > 0 ? (
            <div className="space-y-4">
              {dashboard.recentSubmissions.map(sub => (
                <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 gap-4">
                  <div className="flex flex-col">
                    <span className="font-medium">{sub.studentName}</span>
                    <span className="text-sm text-gray-500">Submitted {format(new Date(sub.submittedAt), "MMM d, h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sub.status === 'submitted' ? "outline" : sub.status === 'late' ? "destructive" : "secondary"}>
                      {sub.status}
                    </Badge>
                    <Button size="sm" asChild>
                      <Link href={`/assignments/${sub.assignmentId}`}>Grade</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center p-6 text-gray-500">
               No recent submissions found.
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const { data: dashboard, isLoading } = useGetAdminDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Students</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.totalStudents}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Cohorts</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.activeCohorts} / {dashboard.totalCohorts}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Applications</CardTitle>
            <FileText className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.pendingScholarshipCount}</div>
            <Button variant="link" size="sm" className="px-0 mt-1 h-auto text-xs" asChild>
              <Link href="/admin/scholarship-applications">Review applications</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{dashboard.totalCourses}</div>
            <Button variant="link" size="sm" className="px-0 mt-1 h-auto text-xs" asChild>
              <Link href="/courses">Manage courses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="font-display">Recent Announcements</CardTitle>
            <CardDescription>Global and cohort-specific updates</CardDescription>
          </CardHeader>
          <CardContent>
             {dashboard.recentAnnouncements.length > 0 ? (
              <div className="space-y-4">
                {dashboard.recentAnnouncements.map(ann => (
                  <div key={ann.id} className="flex flex-col p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{ann.title}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(ann.createdAt), "MMM d")}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{ann.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 text-gray-500">
                No recent announcements.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="font-display">Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex-col items-center justify-center gap-2" asChild>
                  <Link href="/admin/users">
                    <Users className="h-5 w-5" />
                    Manage Users
                  </Link>
                </Button>
                <Button variant="outline" className="h-20 flex-col items-center justify-center gap-2" asChild>
                  <Link href="/cohorts">
                    <Users className="h-5 w-5" />
                    Manage Cohorts
                  </Link>
                </Button>
                <Button variant="outline" className="h-20 flex-col items-center justify-center gap-2" asChild>
                  <Link href="/courses">
                    <BookOpen className="h-5 w-5" />
                    Manage Curriculum
                  </Link>
                </Button>
                <Button variant="outline" className="h-20 flex-col items-center justify-center gap-2" asChild>
                  <Link href="/admin/scholarship-applications">
                    <FileText className="h-5 w-5" />
                    Review Scholars
                  </Link>
                </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => (
          <Card key={i} className="shadow-sm border-gray-100">
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-gray-100 h-64"><CardContent className="p-6"><Skeleton className="h-full w-full" /></CardContent></Card>
        <Card className="shadow-sm border-gray-100 h-64"><CardContent className="p-6"><Skeleton className="h-full w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: me } = useGetMe();

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900">Welcome back, {me?.name?.split(' ')[0] || 'User'}</h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your learning journey.</p>
      </div>

      {me?.role === "student" && <StudentDashboard />}
      {me?.role === "mentor" && <MentorDashboard />}
      {me?.role === "admin" && <AdminDashboard />}
    </div>
  );
}
