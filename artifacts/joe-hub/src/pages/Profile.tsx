import { useState, useEffect } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { data: me, isLoading } = useGetMe();
  const updateMutation = useUpdateMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    avatarUrl: ""
  });

  useEffect(() => {
    if (me) {
      setFormData({
        name: me.name || "",
        bio: me.bio || "",
        avatarUrl: me.avatarUrl || ""
      });
    }
  }, [me]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    updateMutation.mutate({
      data: formData
    }, {
      onSuccess: (updatedUser) => {
        toast({ title: "Success", description: "Profile updated successfully." });
        queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 max-w-2xl mx-auto space-y-6"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-[500px] w-full"/></div>;
  }

  if (!me) return null;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900">Your Profile</h1>
        <p className="text-gray-500 mt-1">Manage your personal information and identity.</p>
      </div>

      <Card className="shadow-sm border-gray-200 overflow-hidden">
        <div className="h-32 bg-primary/10 relative">
           <div className="absolute -bottom-12 left-8 border-4 border-white rounded-full bg-white">
             <Avatar className="h-24 w-24">
                <AvatarImage src={formData.avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary text-white text-2xl font-bold">{me.name.substring(0,2).toUpperCase()}</AvatarFallback>
             </Avatar>
           </div>
        </div>
        <div className="pt-16 pb-6 px-8 flex justify-between items-start border-b border-gray-100">
           <div>
             <h2 className="text-2xl font-display font-bold text-gray-900 leading-none mb-2">{me.name}</h2>
             <div className="text-gray-500">{me.email}</div>
           </div>
           <Badge variant="secondary" className="capitalize text-sm px-3 py-1 bg-gray-100">{me.role}</Badge>
        </div>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                required
                className="max-w-md"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar Image URL</Label>
              <Input 
                id="avatarUrl" 
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={formData.avatarUrl} 
                onChange={e => setFormData({...formData, avatarUrl: e.target.value})} 
                className="max-w-md"
              />
              <p className="text-xs text-gray-500">Provide a direct link to an image to use as your avatar.</p>
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea 
                id="bio" 
                placeholder="Tell the community a little about yourself..."
                value={formData.bio} 
                onChange={e => setFormData({...formData, bio: e.target.value})} 
                rows={4}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending || formData.name === ''}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
