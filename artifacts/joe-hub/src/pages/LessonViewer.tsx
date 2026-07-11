import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useGetLesson, useListLessonResources, useSetLessonProgress, useToggleLessonBookmark, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, PlayCircle, FileText, CheckCircle, Bookmark, BookmarkCheck, ExternalLink, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetLessonQueryKey } from "@workspace/api-client-react";

export default function LessonViewer() {
  const params = useParams();
  const lessonId = Number(params.id);
  
  const { data: lesson, isLoading: isLoadingLesson } = useGetLesson(lessonId);
  const { data: resources, isLoading: isLoadingResources } = useListLessonResources(lessonId);
  
  const queryClient = useQueryClient();
  const setProgress = useSetLessonProgress();
  const toggleBookmark = useToggleLessonBookmark();
  
  const toggleCompletion = () => {
    if (!lesson) return;
    const newState = !lesson.completed;
    setProgress.mutate(
      { id: lessonId, data: { completed: newState } },
      {
        onSuccess: () => {
          queryClient.setQueryData(getGetLessonQueryKey(lessonId), (old: any) => 
            old ? { ...old, completed: newState } : old
          );
        }
      }
    );
  };

  const handleToggleBookmark = () => {
    if (!lesson) return;
    const newState = !lesson.bookmarked;
    toggleBookmark.mutate(
      { id: lessonId },
      {
        onSuccess: () => {
          queryClient.setQueryData(getGetLessonQueryKey(lessonId), (old: any) => 
            old ? { ...old, bookmarked: newState } : old
          );
        }
      }
    );
  };

  if (isLoadingLesson) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    );
  }

  if (!lesson) return <div className="p-8 text-center text-gray-500">Lesson not found.</div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-3 text-gray-500">
          <Link href={`/courses`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Course
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleToggleBookmark}
            className={lesson.bookmarked ? "text-primary hover:text-primary" : "text-gray-500"}
          >
            {lesson.bookmarked ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
            {lesson.bookmarked ? "Bookmarked" : "Bookmark"}
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-display font-bold text-gray-900 mb-6 leading-tight">{lesson.title}</h1>

      {lesson.videoUrl && (
        <div className="aspect-video w-full bg-black rounded-xl overflow-hidden mb-8 shadow-md relative group">
          {/* Simple video embed handling depending on URL type - normally would use a proper player */}
          {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? (
            <iframe 
              src={`https://www.youtube.com/embed/${lesson.videoUrl.split(/v=|youtu\.be\//)[1]?.split('&')[0]}`}
              className="w-full h-full border-0"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900">
              <PlayCircle className="h-16 w-16 mb-4 opacity-50" />
              <p>Video content available via direct link</p>
              <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline mt-2 flex items-center gap-1">
                Open in new tab <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {lesson.content && (
        <div className="prose prose-gray max-w-none mb-10 prose-headings:font-display prose-a:text-primary hover:prose-a:text-[#D94E04]">
          {/* Ideally use a markdown parser if content is markdown, otherwise raw text */}
          <div dangerouslySetInnerHTML={{ __html: lesson.content.replace(/\n/g, '<br/>') }} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6 items-start mt-12 border-t pt-8">
        <div className="flex-1 w-full">
          <h3 className="text-lg font-bold font-display mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            Resources
          </h3>
          {isLoadingResources ? (
             <Skeleton className="h-20 w-full" />
          ) : resources && resources.length > 0 ? (
            <div className="grid gap-3">
              {resources.map(res => (
                <a 
                  key={res.id} 
                  href={res.fileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                >
                  <div className="w-10 h-10 rounded bg-gray-100 text-gray-500 flex items-center justify-center mr-3 group-hover:bg-white group-hover:text-primary">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{res.title}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">{res.fileType || 'Document'}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No resources attached to this lesson.</p>
          )}
        </div>

        <div className="w-full sm:w-72 shrink-0 bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col items-center text-center">
          <h4 className="font-medium text-gray-900 mb-2">Lesson Progress</h4>
          <p className="text-sm text-gray-500 mb-6">Mark this lesson as completed to track your journey.</p>
          <Button 
            size="lg" 
            className="w-full relative overflow-hidden transition-all duration-300"
            variant={lesson.completed ? "outline" : "default"}
            onClick={toggleCompletion}
          >
            {lesson.completed ? (
              <>
                <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                Completed
              </>
            ) : (
              "Mark as Complete"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
