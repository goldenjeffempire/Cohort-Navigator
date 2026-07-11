import { useListAnnouncements, useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Megaphone, MessageSquare, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Announcements() {
  const { data: announcements, isLoading } = useListAnnouncements();
  const { data: me } = useGetMe();
  
  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">Stay updated with the latest from JOE Hub.</p>
        </div>
        {isStaff && (
          <Button>New Post</Button>
        )}
      </div>

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
                {ann.cohortId ? (
                   <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Cohort Specific</Badge>
                ) : (
                   <Badge variant="outline" className="bg-white">Global Announcement</Badge>
                )}
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
