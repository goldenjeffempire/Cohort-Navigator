import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetAssignment, useGetMe, useSubmitAssignment, useListMySubmissions, useListSubmissions, useGradeSubmission } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Calendar, FileText, CheckCircle, ExternalLink, MessageSquare, Clock } from "lucide-react";
import { format, isPast } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function StudentSubmissionView({ assignmentId, maxScore }: { assignmentId: number, maxScore: number }) {
  const { data: submissions, isLoading } = useListMySubmissions(assignmentId);
  const submitMutation = useSubmitAssignment();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [fileUrl, setFileUrl] = useState("");
  const [comment, setComment] = useState("");

  const activeSubmission = submissions?.[0]; // Get most recent

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl && !comment) {
      toast({ title: "Error", description: "Please provide a link or a comment.", variant: "destructive" });
      return;
    }

    submitMutation.mutate({
      id: assignmentId,
      data: { fileUrl, comment }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Assignment submitted successfully." });
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}/submissions/me`] });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message || "Failed to submit.", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (activeSubmission) {
    return (
      <Card className="border-green-100 shadow-sm overflow-hidden">
        <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Submission Received
          </div>
          <Badge variant={activeSubmission.status === 'graded' ? 'default' : 'secondary'} className={activeSubmission.status === 'graded' ? 'bg-green-600' : ''}>
            {activeSubmission.status}
          </Badge>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Work</h4>
               {activeSubmission.fileUrl ? (
                 <a href={activeSubmission.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-primary group transition-colors">
                   <FileText className="h-5 w-5" />
                   <span className="truncate font-medium flex-1 text-sm">{activeSubmission.fileUrl}</span>
                   <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                 </a>
               ) : (
                 <p className="text-sm text-gray-500 italic">No file/link attached.</p>
               )}
               
               {activeSubmission.comment && (
                 <div className="mt-4">
                   <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Comment</h4>
                   <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                     {activeSubmission.comment}
                   </div>
                 </div>
               )}
             </div>

             <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
               <h4 className="font-display font-bold text-lg mb-4 text-gray-900">Grading & Feedback</h4>
               {activeSubmission.status === 'graded' ? (
                 <div>
                   <div className="flex items-baseline gap-2 mb-4 pb-4 border-b border-gray-200">
                     <span className="text-4xl font-display font-bold text-gray-900">{activeSubmission.score}</span>
                     <span className="text-gray-500 font-medium">/ {maxScore}</span>
                   </div>
                   {activeSubmission.feedback ? (
                     <div>
                       <div className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-gray-400"/> Mentor Feedback</div>
                       <p className="text-sm text-gray-600 leading-relaxed">{activeSubmission.feedback}</p>
                     </div>
                   ) : (
                     <p className="text-sm text-gray-500 italic">No specific feedback provided.</p>
                   )}
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-6">
                   <Clock className="h-8 w-8 mb-2 opacity-20" />
                   <p className="text-sm">Your submission is in the queue.<br/>A mentor will review it soon.</p>
                 </div>
               )}
             </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="font-display">Submit Assignment</CardTitle>
        <CardDescription>Provide a link to your work (e.g. GitHub repo, Google Doc, Figma file)</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileUrl">Submission Link</Label>
            <Input 
              id="fileUrl" 
              placeholder="https://..." 
              value={fileUrl} 
              onChange={e => setFileUrl(e.target.value)} 
              type="url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Additional Comments (Optional)</Label>
            <Textarea 
              id="comment" 
              placeholder="Any context the reviewer should know?" 
              value={comment} 
              onChange={e => setComment(e.target.value)} 
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 border-t border-gray-100 py-4">
          <Button type="submit" disabled={submitMutation.isPending} className="w-full sm:w-auto">
            {submitMutation.isPending ? "Submitting..." : "Submit Work"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function MentorSubmissionsQueue({ assignmentId, maxScore }: { assignmentId: number, maxScore: number }) {
  const { data: submissions, isLoading } = useListSubmissions(assignmentId);
  const gradeMutation = useGradeSubmission();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeGradingId, setActiveGradingId] = useState<number | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  const startGrading = (sub: any) => {
    setActiveGradingId(sub.id);
    setScore(sub.score ? String(sub.score) : "");
    setFeedback(sub.feedback || "");
  };

  const handleGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGradingId) return;

    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > maxScore) {
      toast({ title: "Error", description: `Score must be a number between 0 and ${maxScore}.`, variant: "destructive" });
      return;
    }

    gradeMutation.mutate({
      id: activeGradingId,
      data: { score: numScore, feedback }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Grade saved." });
        setActiveGradingId(null);
        queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}/submissions`] });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message || "Failed to grade.", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!submissions || submissions.length === 0) {
    return <div className="p-8 text-center border rounded-xl border-dashed bg-gray-50 text-gray-500">No submissions yet.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-display font-bold">Submissions Queue</h3>
      
      {submissions.map(sub => (
        <Card key={sub.id} className="border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="font-medium text-gray-900">{sub.studentName}</div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{format(new Date(sub.submittedAt), "MMM d, h:mm a")}</span>
              <Badge variant={sub.status === 'graded' ? 'default' : 'secondary'} className={sub.status === 'graded' ? 'bg-green-600' : ''}>{sub.status}</Badge>
            </div>
          </div>
          
          <div className="p-4 flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              {sub.fileUrl && (
                 <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 p-2 border border-gray-200 rounded text-sm hover:bg-gray-50 text-primary">
                   <ExternalLink className="h-4 w-4" /> Open Submission Link
                 </a>
              )}
              {sub.comment && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Student Comment</div>
                  <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">{sub.comment}</div>
                </div>
              )}
              
              {sub.status === 'graded' && activeGradingId !== sub.id && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 mt-4">
                  <div className="flex justify-between items-start mb-2">
                     <div className="font-medium text-green-900">Score: {sub.score} / {maxScore}</div>
                     <Button variant="ghost" size="sm" onClick={() => startGrading(sub)} className="h-8 px-2 text-green-700">Edit Grade</Button>
                  </div>
                  {sub.feedback && <p className="text-sm text-green-800">{sub.feedback}</p>}
                </div>
              )}
            </div>
            
            {(sub.status !== 'graded' || activeGradingId === sub.id) && (
              <div className="w-full md:w-80 shrink-0 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <form onSubmit={handleGrade} className="space-y-4">
                  <h4 className="font-medium">{activeGradingId === sub.id && sub.status === 'graded' ? 'Edit Grade' : 'Grade Submission'}</h4>
                  <div className="space-y-2">
                    <Label>Score (out of {maxScore})</Label>
                    <Input type="number" min="0" max={maxScore} required value={score} onChange={e => setScore(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Feedback</Label>
                    <Textarea placeholder="Constructive feedback..." rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1" disabled={gradeMutation.isPending}>Save Grade</Button>
                    {activeGradingId === sub.id && <Button type="button" variant="outline" onClick={() => setActiveGradingId(null)}>Cancel</Button>}
                  </div>
                </form>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AssignmentDetail() {
  const params = useParams();
  const assignmentId = Number(params.id);
  const { data: me } = useGetMe();
  const { data: assignment, isLoading } = useGetAssignment(assignmentId);

  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  if (isLoading) return <div className="p-8 space-y-6 max-w-4xl mx-auto"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div>;
  if (!assignment) return <div className="p-8 text-center text-gray-500">Assignment not found.</div>;

  const pastDue = assignment.dueDate ? isPast(new Date(assignment.dueDate)) : false;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pb-24">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-3 text-gray-500">
        <Link href="/assignments">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Assignments
        </Link>
      </Button>

      <div className="mb-10">
        <h1 className="text-4xl font-display font-bold text-gray-900 mb-6 leading-tight">{assignment.title}</h1>
        
        <div className="flex flex-wrap items-center gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
           <div className="flex flex-col">
             <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Due Date</span>
             <span className={`font-medium ${pastDue ? 'text-red-600' : 'text-gray-900'}`}>
               {assignment.dueDate ? format(new Date(assignment.dueDate), "EEEE, MMM d, yyyy 'at' h:mm a") : "No due date"}
             </span>
           </div>
           <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>
           <div className="flex flex-col">
             <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Points</span>
             <span className="font-medium text-gray-900">{assignment.maxScore} pts possible</span>
           </div>
        </div>

        <div className="prose prose-gray max-w-none prose-headings:font-display">
          {assignment.description ? (
            <div dangerouslySetInnerHTML={{ __html: assignment.description.replace(/\n/g, '<br/>') }} />
          ) : (
            <p className="text-gray-500 italic">No detailed instructions provided.</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-10">
        {isStaff ? (
          <MentorSubmissionsQueue assignmentId={assignmentId} maxScore={assignment.maxScore} />
        ) : (
          <StudentSubmissionView assignmentId={assignmentId} maxScore={assignment.maxScore} />
        )}
      </div>
    </div>
  );
}
