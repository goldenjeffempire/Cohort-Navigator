import { useState } from "react";
import { useListAnnouncements, useGetMe, useListCohorts, useCreateAnnouncement, useDeleteAnnouncement } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Megaphone, MessageSquare, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Announcements() {
  const { data: announcements, isLoading, refetch } = useListAnnouncements();
  const { data: me } = useGetMe();
  const { data: cohorts } = useListCohorts();
  const createMutation = useCreateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const { toast } = useToast();

  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cohortId, setCohortId] = useState<string>("none");

  const handleCreate = () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Required fields missing", description: "Title and body are required.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      data: {
        title: title.trim(),
        body: body.trim(),
        cohortId: cohortId && cohortId !== "none" ? Number(cohortId) : undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Announcement posted!" });
        setOpen(false);
        setTitle(""); setBody(""); setCohortId("none");
        refetch();
      },
      onError: () => toast({ title: "Failed to post announcement", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this announcement?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Announcement deleted" }); refetch(); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">Stay updated with the latest from JOE Hub.</p>
        </div>
        {isStaff && (
          <Button onClick={() => setOpen(true)}>New Post</Button>
        )}
      </div>

      {/* Create Announcement Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title *</Label>
              <Input id="ann-title" placeholder="e.g. Week 3 Schedule Update" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">Body *</Label>
              <Textarea id="ann-body" placeholder="Write your announcement..." rows={5} value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-cohort">Target Cohort (optional)</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger id="ann-cohort">
                  <SelectValue placeholder="Global — visible to all" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global — visible to all</SelectItem>
                  {cohorts?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Posting..." : "Post Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Card key={i} className="shadow-sm border-gray-100">
              <CardContent className="p-6 space-y-3">
                 <Skeleton className="h-6 w-1/2" />
                 <Skeleton className="h-4 w-32" />
                 <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : announcements && announcements.length > 0 ? (
        <div className="space-y-6">
          {announcements.map((ann) => (
            <Card key={ann.id} className="shadow-sm border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-gray-900 leading-none mb-1">{ann.title}</h3>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="font-medium text-gray-700">{ann.authorName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {format(new Date(ann.createdAt), "MMM d, yyyy h:mm a")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ann.cohortId ? (
                     <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Cohort Specific</Badge>
                  ) : (
                     <Badge variant="outline" className="bg-white">Global Announcement</Badge>
                  )}
                  {isStaff && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDelete(ann.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="p-6">
                <div className="prose prose-gray max-w-none text-gray-700 prose-p:leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: ann.body.replace(/\n/g, '<br/>') }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">It's quiet here</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            No announcements have been posted yet.
          </p>
        </div>
      )}
    </div>
  );
}
