import { useListAssignments, useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Calendar, ChevronRight, CheckCircle, Clock } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

export default function Assignments() {
  const { data: assignments, isLoading } = useListAssignments();
  const { data: me } = useGetMe();

  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  const getStatusBadge = (status?: string | null) => {
    if (!status) return <Badge variant="outline" className="text-gray-500">Not Submitted</Badge>;
    switch (status) {
      case 'submitted': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Submitted</Badge>;
      case 'graded': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Graded</Badge>;
      case 'late': return <Badge variant="destructive">Late</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDueDateDisplay = (dateString?: string | null) => {
    if (!dateString) return <span className="text-gray-500">No due date</span>;
    const date = new Date(dateString);
    const past = isPast(date) && !isToday(date);
    return (
      <span className={`flex items-center gap-1 ${past ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
        <Calendar className="h-3.5 w-3.5" />
        {format(date, "MMM d, yyyy")}
        {past && " (Past Due)"}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-500 mt-1">Review prompts and submit your work.</p>
        </div>
        {isStaff && (
          <Button>Create Assignment</Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-2"/><Skeleton className="h-4 w-full"/></CardContent></Card>
          ))}
        </div>
      ) : assignments && assignments.length > 0 ? (
        <div className="grid gap-4">
          {assignments.map(assignment => (
            <Card key={assignment.id} className="overflow-hidden hover:border-primary/30 transition-colors shadow-sm group">
              <div className="flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold font-display text-gray-900 mb-1">{assignment.title}</h3>
                    {!isStaff && getStatusBadge(assignment.mySubmissionStatus)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 max-w-3xl">
                    {assignment.description || "No description"}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    {getDueDateDisplay(assignment.dueDate)}
                    <span className="flex items-center gap-1 text-gray-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {assignment.maxScore} points
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 p-6 flex flex-col justify-center sm:border-l border-gray-100 sm:w-48 shrink-0 border-t sm:border-t-0">
                  <Button asChild className="w-full" variant={assignment.mySubmissionStatus ? "outline" : "default"}>
                    <Link href={`/assignments/${assignment.id}`}>
                      {isStaff ? "View Submissions" : (assignment.mySubmissionStatus ? "View Submission" : "Start Assignment")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            You have no pending or past assignments.
          </p>
        </div>
      )}
    </div>
  );
}
