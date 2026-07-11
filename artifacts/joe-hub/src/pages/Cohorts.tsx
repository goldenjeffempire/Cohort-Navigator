import { useListCohorts, useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, ChevronRight, GraduationCap } from "lucide-react";
import { format } from "date-fns";

export default function Cohorts() {
  const { data: cohorts, isLoading } = useListCohorts();
  const { data: me } = useGetMe();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Cohorts</h1>
          <p className="text-gray-500 mt-1">Join a community of learners moving together.</p>
        </div>
        {me?.role === 'admin' && (
          <Button>Create Cohort</Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4 mb-2"/><Skeleton className="h-4 w-1/4"/></CardHeader>
              <CardContent><Skeleton className="h-4 w-full mb-2"/><Skeleton className="h-4 w-5/6"/></CardContent>
            </Card>
          ))}
        </div>
      ) : cohorts && cohorts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cohorts.map(cohort => (
            <Card key={cohort.id} className="shadow-sm border-gray-100 hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className={`capitalize ${getStatusColor(cohort.status)}`}>
                    {cohort.status}
                  </Badge>
                  <div className="flex items-center text-sm font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                    <Users className="h-3.5 w-3.5 mr-1" />
                    {cohort.studentCount}{cohort.capacity ? ` / ${cohort.capacity}` : ''}
                  </div>
                </div>
                <CardTitle className="text-xl font-display leading-tight">{cohort.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                  {cohort.description || "No description provided."}
                </p>
                <div className="flex flex-col gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Started: {format(new Date(cohort.startDate), "MMM d, yyyy")}</span>
                  </div>
                  {cohort.endDate && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <span>Ends: {format(new Date(cohort.endDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-gray-50">
                <Button variant="outline" className="w-full bg-white hover:bg-gray-50 hover:text-primary" asChild>
                  <Link href={`/cohorts/${cohort.id}`}>
                    View Details
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No active cohorts</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            There are currently no cohorts available. Check back later for new enrollments.
          </p>
        </div>
      )}
    </div>
  );
}
