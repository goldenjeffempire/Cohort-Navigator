import { useState } from "react";
import { useListScholarshipApplications, useReviewScholarshipApplication } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, CheckCircle, XCircle, Search } from "lucide-react";

export default function AdminScholarships() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data: applications, isLoading } = useListScholarshipApplications({ status: filter });
  
  const reviewMutation = useReviewScholarshipApplication();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reviewApp, setReviewApp] = useState<any>(null);
  const [action, setAction] = useState<'approved' | 'rejected' | null>(null);
  const [notes, setNotes] = useState("");

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewApp || !action) return;

    reviewMutation.mutate({
      id: reviewApp.id,
      data: { status: action, reviewNotes: notes }
    }, {
      onSuccess: () => {
        toast({ title: "Review Submitted", description: `Application has been ${action}.` });
        setReviewApp(null);
        setAction(null);
        setNotes("");
        queryClient.invalidateQueries({ queryKey: ["/api/scholarship-applications"] });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900">Scholarship Applications</h1>
        <p className="text-gray-500 mt-1">Review and manage incoming student applications.</p>
      </div>

      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full mb-8">
        <TabsList className="bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">Pending Review</TabsTrigger>
          <TabsTrigger value="approved" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : applications && applications.length > 0 ? (
        <div className="grid gap-6">
          {applications.map(app => (
            <Card key={app.id} className="shadow-sm border-gray-200 overflow-hidden">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-gray-900 leading-none">{app.fullName}</span>
                  <span className="text-sm text-gray-500 mt-1">{app.email}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Applied: {format(new Date(app.appliedAt), "MMM d, yyyy")}
                  </div>
                  {app.cohortId && (
                     <Badge variant="outline">Prefers Cohort #{app.cohortId}</Badge>
                  )}
                </div>
              </div>
              <CardContent className="p-6">
                 <div>
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Motivation Essay</h4>
                   <div className="bg-white p-4 rounded-lg border border-gray-100 text-gray-700 text-sm leading-relaxed max-h-64 overflow-y-auto">
                     {app.essay}
                   </div>
                 </div>
                 
                 {app.status === 'pending' && (
                   <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-gray-100">
                     <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-200" onClick={() => { setReviewApp(app); setAction('rejected'); }}>
                       <XCircle className="mr-2 h-4 w-4" /> Reject
                     </Button>
                     <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setReviewApp(app); setAction('approved'); }}>
                       <CheckCircle className="mr-2 h-4 w-4" /> Approve Scholarship
                     </Button>
                   </div>
                 )}

                 {app.status !== 'pending' && (
                    <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-start">
                      <div>
                        <Badge variant={app.status === 'approved' ? 'default' : 'destructive'} className={app.status === 'approved' ? 'bg-green-600' : ''}>
                          {app.status.toUpperCase()}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-2">Reviewed on {format(new Date(app.reviewedAt!), "MMM d, yyyy")}</div>
                      </div>
                      {app.reviewNotes && (
                        <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 italic border border-gray-100 max-w-lg">
                          " {app.reviewNotes} "
                        </div>
                      )}
                    </div>
                 )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-16 bg-white rounded-xl border border-dashed border-gray-200">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No {filter} applications</h3>
          <p className="text-gray-500">The queue is empty for this category.</p>
        </div>
      )}

      <Dialog open={!!reviewApp} onOpenChange={(open) => !open && setReviewApp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Decision</DialogTitle>
            <DialogDescription>
              You are about to <strong className={action === 'approved' ? 'text-green-600' : 'text-red-600'}>{action}</strong> the application for {reviewApp?.fullName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReview}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Review Notes (Optional)</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Internal notes or reason for rejection (visible to student on rejection)" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviewApp(null)}>Cancel</Button>
              <Button type="submit" disabled={reviewMutation.isPending} variant={action === 'approved' ? 'default' : 'destructive'} className={action === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}>
                {reviewMutation.isPending ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
