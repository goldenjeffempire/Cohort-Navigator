import { useListMyScholarshipApplications } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function ScholarshipStatus() {
  const { data: apps, isLoading } = useListMyScholarshipApplications();

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'approved': 
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', text: 'Approved', badge: 'bg-green-600' };
      case 'rejected': 
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', text: 'Not Accepted', badge: 'bg-red-600' };
      default: 
        return { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'Under Review', badge: 'bg-orange-500' };
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900">Application Status</h1>
        <Button variant="outline" asChild>
          <Link href="/scholarship/apply">New Application</Link>
        </Button>
      </div>

      {isLoading ? (
         <div className="space-y-6">
           <Skeleton className="h-64 w-full rounded-2xl" />
         </div>
      ) : apps && apps.length > 0 ? (
        <div className="space-y-6">
          {apps.map(app => {
            const display = getStatusDisplay(app.status);
            const Icon = display.icon;
            return (
              <Card key={app.id} className={`overflow-hidden border-2 ${display.border} shadow-sm`}>
                <div className={`${display.bg} px-6 py-4 flex items-center justify-between border-b ${display.border}`}>
                  <div className={`flex items-center gap-2 font-bold ${display.color}`}>
                    <Icon className="h-5 w-5" />
                    {display.text}
                  </div>
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <FileText className="h-4 w-4 text-gray-400" />
                    Applied {format(new Date(app.appliedAt), "MMM d, yyyy")}
                  </span>
                </div>
                <CardContent className="p-8 bg-white">
                   <div className="grid md:grid-cols-3 gap-8">
                     <div className="md:col-span-2 space-y-6">
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Target Cohort</h4>
                          <div className="font-medium text-gray-900 text-lg">
                            {app.cohortId ? `Cohort #${app.cohortId}` : "Any Available Cohort"}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Your Essay</h4>
                          <div className="p-4 bg-gray-50 rounded-lg text-gray-600 text-sm leading-relaxed border border-gray-100 max-h-48 overflow-y-auto">
                            {app.essay}
                          </div>
                        </div>
                     </div>
                     <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col justify-center text-center">
                        {app.status === 'pending' ? (
                          <>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                              <Clock className="h-6 w-6 text-orange-400 animate-pulse" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">Review in Progress</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                              Our team is currently reviewing your application. We will notify you once a decision is made.
                            </p>
                          </>
                        ) : app.status === 'approved' ? (
                          <>
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">Welcome to JOE Hub!</h4>
                            <p className="text-sm text-gray-500 leading-relaxed mb-6">
                              Your scholarship has been approved. You are now ready to begin your learning journey.
                            </p>
                            <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
                              <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4"/></Link>
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <XCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">Update</h4>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4">
                              Unfortunately, we cannot offer you a scholarship at this time due to high volume.
                            </p>
                            {app.reviewNotes && (
                              <div className="text-xs text-left bg-white p-3 rounded border border-red-100 italic text-gray-600 mt-2">
                                "{app.reviewNotes}"
                              </div>
                            )}
                          </>
                        )}
                     </div>
                   </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <FileText className="h-16 w-16 text-gray-200 mx-auto mb-6" />
          <h3 className="text-2xl font-display font-bold text-gray-900 mb-3">Start Your Journey</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-8 text-lg">
            You haven't applied for a scholarship yet. Ready to level up your career?
          </p>
          <Button size="lg" className="h-14 px-8" asChild>
            <Link href="/scholarship/apply">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      )}
    </div>
  );
}
