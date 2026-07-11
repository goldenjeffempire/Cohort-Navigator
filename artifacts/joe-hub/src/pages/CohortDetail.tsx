import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetCohort, useListCohortEnrollments, useListCohortMentors, useListCohortCourses,
  useGetMe, useUpdateCohort, useEnrollStudent, useAssignMentor, useAddCohortCourse,
  useListUsers, useListCourses, useRemoveEnrollment, useUnassignMentor,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Users, BookOpen, GraduationCap, Calendar, UserPlus, Trash2, Plus } from "lucide-react";
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

export default function CohortDetail() {
  const params = useParams();
  const cohortId = Number(params.id);
  const { data: me } = useGetMe();
  const { toast } = useToast();

  const { data: cohort, isLoading: isLoadingCohort, refetch: refetchCohort } = useGetCohort(cohortId);
  const { data: enrollments, isLoading: isLoadingEnrollments, refetch: refetchEnrollments } = useListCohortEnrollments(cohortId);
  const { data: mentors, isLoading: isLoadingMentors, refetch: refetchMentors } = useListCohortMentors(cohortId);
  const { data: courses, isLoading: isLoadingCourses, refetch: refetchCourses } = useListCohortCourses(cohortId);
  const { data: allUsers } = useListUsers();
  const { data: allCourses } = useListCourses();

  const updateMutation = useUpdateCohort();
  const enrollMutation = useEnrollStudent();
  const assignMentorMutation = useAssignMentor();
  const addCourseMutation = useAddCohortCourse();
  const removeEnrollmentMutation = useRemoveEnrollment();
  const unassignMentorMutation = useUnassignMentor();

  const isAdmin = me?.role === 'admin';
  const isStaff = me?.role === 'admin' || me?.role === 'mentor';

  // Edit cohort dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", startDate: "", endDate: "", status: "upcoming" as string, capacity: "" });
  const setEdit = (f: string, v: string) => setEditForm(prev => ({ ...prev, [f]: v }));

  const openEdit = () => {
    if (!cohort) return;
    setEditForm({
      name: cohort.name,
      description: cohort.description || "",
      startDate: cohort.startDate,
      endDate: cohort.endDate || "",
      status: cohort.status,
      capacity: cohort.capacity ? String(cohort.capacity) : "",
    });
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    updateMutation.mutate({
      id: cohortId,
      data: {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        status: editForm.status as "upcoming" | "active" | "completed",
        capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
      }
    }, {
      onSuccess: () => { toast({ title: "Cohort updated!" }); setEditOpen(false); refetchCohort(); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  // Enroll student dialog
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const enrolledStudentIds = new Set(enrollments?.map(e => e.studentId));
  const availableStudents = allUsers?.filter(u => u.role === 'student' && !enrolledStudentIds.has(u.id)) || [];

  const handleEnroll = () => {
    if (!selectedStudentId) { toast({ title: "Select a student", variant: "destructive" }); return; }
    enrollMutation.mutate({
      id: cohortId,
      data: { studentId: Number(selectedStudentId) }
    }, {
      onSuccess: () => { toast({ title: "Student enrolled!" }); setEnrollOpen(false); setSelectedStudentId(""); refetchEnrollments(); },
      onError: () => toast({ title: "Failed to enroll student", variant: "destructive" }),
    });
  };

  // Assign mentor dialog
  const [mentorOpen, setMentorOpen] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<string>("");
  const assignedMentorIds = new Set(mentors?.map(m => m.mentorId));
  const availableMentors = allUsers?.filter(u => u.role === 'mentor' && !assignedMentorIds.has(u.id)) || [];

  const handleAssignMentor = () => {
    if (!selectedMentorId) { toast({ title: "Select a mentor", variant: "destructive" }); return; }
    assignMentorMutation.mutate({
      id: cohortId,
      data: { mentorId: Number(selectedMentorId) }
    }, {
      onSuccess: () => { toast({ title: "Mentor assigned!" }); setMentorOpen(false); setSelectedMentorId(""); refetchMentors(); },
      onError: () => toast({ title: "Failed to assign mentor", variant: "destructive" }),
    });
  };

  // Add course dialog
  const [courseOpen, setCourseOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseOrder, setCourseOrder] = useState<string>("");
  const cohortCourseIds = new Set(courses?.map(c => c.courseId));
  const availableCourses = allCourses?.filter(c => !cohortCourseIds.has(c.id)) || [];

  const handleAddCourse = () => {
    if (!selectedCourseId) { toast({ title: "Select a course", variant: "destructive" }); return; }
    addCourseMutation.mutate({
      id: cohortId,
      data: { courseId: Number(selectedCourseId), order: courseOrder ? Number(courseOrder) : (courses?.length || 0) }
    }, {
      onSuccess: () => { toast({ title: "Course added to learning path!" }); setCourseOpen(false); setSelectedCourseId(""); setCourseOrder(""); refetchCourses(); },
      onError: () => toast({ title: "Failed to add course", variant: "destructive" }),
    });
  };

  const handleRemoveEnrollment = (enrollmentId: number) => {
    if (!confirm("Remove this student from the cohort?")) return;
    removeEnrollmentMutation.mutate({ id: cohortId, studentId: enrollmentId }, {
      onSuccess: () => { toast({ title: "Student removed" }); refetchEnrollments(); },
      onError: () => toast({ title: "Failed to remove student", variant: "destructive" }),
    });
  };

  const handleUnassignMentor = (mentorId: number) => {
    if (!confirm("Remove this mentor from the cohort?")) return;
    unassignMentorMutation.mutate({ id: cohortId, mentorId }, {
      onSuccess: () => { toast({ title: "Mentor unassigned" }); refetchMentors(); },
      onError: () => toast({ title: "Failed to remove mentor", variant: "destructive" }),
    });
  };

  if (isLoadingCohort) {
    return <div className="p-8 space-y-6 max-w-6xl mx-auto"><Skeleton className="h-8 w-24" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cohort) return <div className="p-8 text-center text-gray-500">Cohort not found.</div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-3 text-gray-500">
        <Link href="/cohorts">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Cohorts
        </Link>
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="uppercase tracking-wider">{cohort.status}</Badge>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(cohort.startDate), "MMM d, yyyy")}
              {cohort.endDate && ` - ${format(new Date(cohort.endDate), "MMM d, yyyy")}`}
            </span>
          </div>
          <h1 className="text-4xl font-display font-bold text-gray-900">{cohort.name}</h1>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={openEdit}>Edit Cohort</Button>
        )}
      </div>

      <p className="text-lg text-gray-600 max-w-3xl mb-10 leading-relaxed">
        {cohort.description || "No description provided for this cohort."}
      </p>

      {/* Edit Cohort Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Cohort</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editForm.name} onChange={e => setEdit("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} value={editForm.description} onChange={e => setEdit("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={editForm.startDate} onChange={e => setEdit("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={editForm.endDate} onChange={e => setEdit("endDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEdit("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" value={editForm.capacity} onChange={e => setEdit("capacity", e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Student Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll Student</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder={availableStudents.length === 0 ? "No students available" : "Choose a student..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableStudents.length === 0 && (
                <p className="text-sm text-gray-500">All students are already enrolled, or no students have registered yet.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button onClick={handleEnroll} disabled={enrollMutation.isPending || !selectedStudentId}>
              {enrollMutation.isPending ? "Enrolling..." : "Enroll Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Mentor Dialog */}
      <Dialog open={mentorOpen} onOpenChange={setMentorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Mentor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Mentor</Label>
              <Select value={selectedMentorId} onValueChange={setSelectedMentorId}>
                <SelectTrigger>
                  <SelectValue placeholder={availableMentors.length === 0 ? "No mentors available" : "Choose a mentor..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableMentors.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableMentors.length === 0 && (
                <p className="text-sm text-gray-500">No unassigned mentors found. Users must have the 'mentor' role.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMentorOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignMentor} disabled={assignMentorMutation.isPending || !selectedMentorId}>
              {assignMentorMutation.isPending ? "Assigning..." : "Assign Mentor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Course Dialog */}
      <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Course to Learning Path</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Course</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={availableCourses.length === 0 ? "All courses already added" : "Choose a course..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableCourses.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order / Phase Number</Label>
              <Input type="number" placeholder={`e.g. ${(courses?.length || 0) + 1}`} value={courseOrder} onChange={e => setCourseOrder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCourse} disabled={addCourseMutation.isPending || !selectedCourseId}>
              {addCourseMutation.isPending ? "Adding..." : "Add to Path"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="roster" className="w-full">
        <TabsList className="mb-8 w-full justify-start h-auto p-1 bg-gray-100/50 rounded-xl">
          <TabsTrigger value="roster" className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-2" /> Roster
          </TabsTrigger>
          <TabsTrigger value="path" className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BookOpen className="h-4 w-4 mr-2" /> Learning Path
          </TabsTrigger>
          <TabsTrigger value="mentors" className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <GraduationCap className="h-4 w-4 mr-2" /> Mentors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold">Students ({enrollments?.length || 0})</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setEnrollOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Enroll Student
              </Button>
            )}
          </div>

          {isLoadingEnrollments ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : enrollments && enrollments.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollments.map(enr => (
                <div key={enr.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm group">
                  <Avatar className="h-10 w-10 border border-gray-100">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">{enr.studentName.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{enr.studentName}</div>
                    <div className="text-xs text-gray-500 truncate">{enr.studentEmail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={enr.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase">{enr.status}</Badge>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600" onClick={() => handleRemoveEnrollment(enr.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
              No students enrolled yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="path" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold">Curriculum Roadmap</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setCourseOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Course
              </Button>
            )}
          </div>

          {isLoadingCourses ? (
             <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
          ) : courses && courses.length > 0 ? (
            <div className="space-y-3 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {courses.sort((a, b) => a.order - b.order).map((c, i) => (
                <div key={c.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white bg-gray-100 text-gray-400 group-hover:bg-primary group-hover:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 transition-colors">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Phase {i + 1}</div>
                    <div className="font-bold text-gray-900 mb-2">{c.courseTitle}</div>
                    <Button variant="link" size="sm" className="px-0 h-auto" asChild>
                       <Link href={`/courses/${c.courseId}`}>View Course Modules</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
              No courses assigned to this cohort's learning path.
            </div>
          )}
        </TabsContent>

        <TabsContent value="mentors" className="space-y-4">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold">Assigned Mentors</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setMentorOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Assign Mentor
              </Button>
            )}
          </div>

          {isLoadingMentors ? (
            <div className="grid md:grid-cols-3 gap-4"><Skeleton className="h-32 w-full" /></div>
          ) : mentors && mentors.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {mentors.map(m => (
                <Card key={m.id} className="border-gray-100 shadow-sm text-center p-6 relative group">
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600" onClick={() => handleUnassignMentor(m.mentorId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Avatar className="h-16 w-16 mx-auto mb-4 border-2 border-gray-50">
                    <AvatarFallback className="bg-orange-100 text-orange-700 text-xl">{m.mentorName.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="font-bold text-gray-900">{m.mentorName}</div>
                  <div className="text-sm text-gray-500 mb-4">{m.mentorEmail}</div>
                  <Badge variant="secondary">Mentor</Badge>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
              No mentors assigned yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
