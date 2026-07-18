import * as React from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  LayoutDashboard, BookOpen, Users, ClipboardList, AlertCircle, 
  Bell, Award, Settings, LogOut, Loader2, Menu, Megaphone,
  Code2, Terminal, BarChart3, Brain, Activity,
  Globe, MessageSquare, Users2, FolderOpen, Calendar, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function AppSidebar() {
  const [location] = useLocation();
  const { data: me, isLoading } = useGetMe();
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Courses", href: "/courses", icon: BookOpen },
    { label: "Cohorts", href: "/cohorts", icon: Users },
    { label: "Assignments", href: "/assignments", icon: ClipboardList },
    { label: "Quizzes", href: "/quizzes", icon: AlertCircle },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    // Phase 3 — always visible
    { label: "Challenges", href: "/challenges", icon: Code2 },
    { label: "Workspace", href: "/workspace", icon: Terminal },
    { label: "Progress", href: "/coding-progress", icon: BarChart3 },
    // Phase 4 — AI
    { label: "AI Hub", href: "/ai", icon: Brain },
    { label: "My Analytics", href: "/ai/analytics", icon: Activity },
    // Phase 5 — Community & Collaboration
    { label: "Community", href: "/community", icon: Globe },
    { label: "Discussions", href: "/discussions", icon: MessageSquare },
    { label: "Messages", href: "/messages", icon: MessageSquare },
    { label: "Mentorship", href: "/mentorship", icon: Users2 },
    { label: "Teams", href: "/teams", icon: FolderOpen },
    { label: "Events", href: "/events", icon: Calendar },
  ];

  if (me?.role === "student") {
    navItems.push(
      { label: "Scholarship", href: "/scholarship/status", icon: Award }
    );
  } else if (me?.role === "admin") {
    navItems.push(
      { label: "Applications", href: "/admin/scholarship-applications", icon: Award },
      { label: "Users", href: "/admin/users", icon: Settings },
      { label: "Manage Challenges", href: "/admin/challenges", icon: Code2 },
      { label: "AI Platform", href: "/admin/ai", icon: Brain },
      // Phase 5 admin
      { label: "Community Mgmt", href: "/admin/community", icon: Globe },
      { label: "Moderation", href: "/admin/moderation", icon: Shield },
      { label: "Integrations", href: "/admin/integrations", icon: Zap },
    );
  } else if (me?.role === "mentor") {
    navItems.push(
      { label: "Manage Challenges", href: "/admin/challenges", icon: Code2 },
      { label: "AI Platform", href: "/admin/ai", icon: Brain },
    );
  }

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg text-sidebar-foreground">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
            JH
          </div>
          <span>JOE Hub</span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : me ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={me.avatarUrl || undefined} alt={me.name} />
                  <AvatarFallback className="rounded-lg">{me.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 text-left text-sm leading-tight ml-2">
                  <span className="font-medium truncate">{me.name}</span>
                  <span className="text-xs text-muted-foreground truncate capitalize">{me.role}</span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" sideOffset={8}>
              <DropdownMenuLabel className="font-normal flex gap-2 items-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={me.avatarUrl || undefined} />
                  <AvatarFallback>{me.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{me.name}</span>
                  <span className="text-xs text-muted-foreground">{me.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer w-full flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="cursor-pointer w-full flex items-center">
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Notifications</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function MobileHeader() {
  const { toggleSidebar } = useSidebar();
  const [location] = useLocation();

  const pageTitle = React.useMemo(() => {
    if (location === "/dashboard") return "Dashboard";
    if (location.startsWith("/courses")) return "Courses";
    if (location.startsWith("/cohorts")) return "Cohorts";
    if (location.startsWith("/assignments")) return "Assignments";
    if (location.startsWith("/quizzes")) return "Quizzes";
    if (location.startsWith("/announcements")) return "Announcements";
    if (location.startsWith("/notifications")) return "Notifications";
    if (location.startsWith("/profile")) return "Profile";
    if (location.startsWith("/admin/users")) return "Users";
    if (location.startsWith("/admin/scholarship")) return "Applications";
    if (location.startsWith("/admin/challenges")) return "Manage Challenges";
    if (location.startsWith("/scholarship/apply")) return "Apply for Scholarship";
    if (location.startsWith("/scholarship/status")) return "Application Status";
    // Phase 3
    if (location.startsWith("/challenges")) return "Coding Challenges";
    if (location.startsWith("/workspace")) return "Workspace";
    if (location.startsWith("/coding-progress")) return "Coding Progress";
    return "";
  }, [location]);

  return (
    <header className="md:hidden flex items-center h-16 px-4 border-b bg-background sticky top-0 z-30 w-full shrink-0">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} className="-ml-2 mr-2">
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="font-display font-semibold">{pageTitle}</h1>
      <div className="ml-auto">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/notifications">
            <Bell className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useGetMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-gray-50/50">
        <MobileHeader />
        <main className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
