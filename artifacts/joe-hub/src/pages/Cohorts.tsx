import { useState } from "react";
import { useListCohorts, useGetMe, useCreateCohort } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, ChevronRight, GraduationCap, Plus } from "lucide-react";
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

export default function Cohorts() {
  const { data: cohorts, isLoading, refetch } = useListCohorts();
  const { data: me } = useGetMe();
  const createMutation = useCreateCohort();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", startDate: "", endDate: "",
    status: "upcoming" as "upcoming" | "active" | "completed",
    capacity: "",
  });

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCreate = () => {
    if (!form.name.trim() || !form.startDate) {
      toast({ title: "Name and Start Date are required.", variant: "destructive" }); return;
    }
    createMutation.mutate({
      data: {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        status: form.status,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Cohort created!" });
        setOpen(false);
        setForm({ name: "", description: "", startDate: "", endDate: "", status: "upcoming", capacity: "" });
        refetch();
      },
      onError: () => toast({ title: "Failed to create cohort", variant: "destructive" }),
    });
  };

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
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Cohort
          </Button>
        )}
      </div>

      {/* Create Cohort Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Cohort</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Cohort Name *</Label>
              <Input id="c-name" placeholder="e.g. JOE Hub Cohort 2026-C" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">Description</Label>
              <Textarea id="c-desc" placeholder="Brief description of this cohort..." rows={3} value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-start">Start Date *</Label>
                <Input id="c-start" type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-end">End Date</Label>
                <Input id="c-end" type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-status">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger id="c-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-cap">Capacity</Label>
                <Input id="c-cap" type="number" placeholder="e.g. 50" value={form.capacity} onChange={e => set("capacity", e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Cohort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
