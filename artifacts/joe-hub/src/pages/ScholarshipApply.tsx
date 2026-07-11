import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateScholarshipApplication, useListCohorts, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Award, ArrowRight } from "lucide-react";

export default function ScholarshipApply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: cohorts } = useListCohorts({ status: 'upcoming' });
  const applyMutation = useCreateScholarshipApplication();

  const [formData, setFormData] = useState({
    fullName: me?.name || "",
    email: me?.email || "",
    cohortId: "",
    essay: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.essay) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    applyMutation.mutate({
      data: {
        fullName: formData.fullName,
        email: formData.email,
        essay: formData.essay,
        cohortId: formData.cohortId ? Number(formData.cohortId) : undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Application Submitted", description: "Your application is under review!" });
        setLocation("/scholarship/status");
      },
      onError: (err) => {
        toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
          <Award className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-display font-bold text-gray-900 mb-4">JOE Hub Scholarship</h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
          We're looking for driven individuals ready to transform their careers. Tell us your story and why you belong here.
        </p>
      </div>

      <Card className="shadow-lg border-gray-200 border-t-4 border-t-primary overflow-hidden">
        <form onSubmit={handleSubmit}>
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-8 pt-8 px-8">
            <CardTitle className="text-2xl font-display">Application Form</CardTitle>
            <CardDescription className="text-base">Please provide detailed answers to help us understand your background.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="fullName" className="text-gray-700 font-medium">Full Name <span className="text-red-500">*</span></Label>
                <Input 
                  id="fullName" 
                  value={formData.fullName} 
                  onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  className="h-12 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="email" className="text-gray-700 font-medium">Email Address <span className="text-red-500">*</span></Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  className="h-12 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="cohort" className="text-gray-700 font-medium">Preferred Cohort (Optional)</Label>
              <Select value={formData.cohortId} onValueChange={v => setFormData({...formData, cohortId: v})}>
                <SelectTrigger id="cohort" className="h-12 bg-gray-50 focus:bg-white transition-colors">
                  <SelectValue placeholder="Select an upcoming cohort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference / Any available</SelectItem>
                  {cohorts?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-4">
              <Label htmlFor="essay" className="text-gray-700 font-medium text-base">Motivation Essay <span className="text-red-500">*</span></Label>
              <p className="text-sm text-gray-500 mb-2">Why do you want to join JOE Hub? What are your career goals and how will this scholarship help you achieve them? (Min. 200 words)</p>
              <Textarea 
                id="essay" 
                rows={10} 
                value={formData.essay} 
                onChange={e => setFormData({...formData, essay: e.target.value})}
                placeholder="Write your story here..."
                className="resize-none bg-gray-50 focus:bg-white transition-colors p-4 leading-relaxed"
              />
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50 border-t border-gray-100 p-8">
            <Button size="lg" type="submit" className="w-full h-14 text-lg" disabled={applyMutation.isPending}>
              {applyMutation.isPending ? "Submitting Application..." : "Submit Application"}
              {!applyMutation.isPending && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
