import { useListQuizzes, useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, FileQuestion, ChevronRight } from "lucide-react";

export default function Quizzes() {
  const { data: quizzes, isLoading } = useListQuizzes();
  const { data: me } = useGetMe();
  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Quizzes</h1>
          <p className="text-gray-500 mt-1">Test your knowledge and earn points.</p>
        </div>
        {isStaff && (
          <Button>Create Quiz</Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-2/3 mb-4"/><Skeleton className="h-4 w-full"/></CardContent></Card>
          ))}
        </div>
      ) : quizzes && quizzes.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map(quiz => (
            <Card key={quiz.id} className="shadow-sm border-gray-100 hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-display line-clamp-2">{quiz.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-gray-500 mb-6 line-clamp-3">
                  {quiz.description || "No description."}
                </p>
                <div className="flex flex-col gap-2 text-sm text-gray-600 font-medium">
                   <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-md">
                     <FileQuestion className="h-4 w-4 text-primary" />
                     {quiz.questionCount} Questions
                   </div>
                   <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-md">
                     <Clock className="h-4 w-4 text-primary" />
                     {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} Minutes` : 'No time limit'}
                   </div>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-gray-50 bg-gray-50/50">
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/quizzes/${quiz.id}`}>
                    {isStaff ? "Manage Quiz" : "Open Quiz"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No quizzes available</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Check back later for knowledge checks.
          </p>
        </div>
      )}
    </div>
  );
}
