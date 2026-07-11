import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import LessonViewer from "@/pages/LessonViewer";
import Cohorts from "@/pages/Cohorts";
import CohortDetail from "@/pages/CohortDetail";
import Assignments from "@/pages/Assignments";
import AssignmentDetail from "@/pages/AssignmentDetail";
import Quizzes from "@/pages/Quizzes";
import QuizDetail from "@/pages/QuizDetail";
import Announcements from "@/pages/Announcements";
import Notifications from "@/pages/Notifications";
import ScholarshipApply from "@/pages/ScholarshipApply";
import ScholarshipStatus from "@/pages/ScholarshipStatus";
import AdminScholarships from "@/pages/AdminScholarships";
import AdminUsers from "@/pages/AdminUsers";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/not-found";
import AppLayout from "@/components/layout/AppLayout";
// Phase 3 — Coding workspace & assessment
import Challenges from "@/pages/Challenges";
import ChallengeDetail from "@/pages/ChallengeDetail";
import Workspace from "@/pages/Workspace";
import CodingProgress from "@/pages/CodingProgress";
import AdminChallenges from "@/pages/AdminChallenges";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(15 90% 55%)",
    colorForeground: "hsl(220 20% 12%)",
    colorMutedForeground: "hsl(220 10% 40%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(220 10% 90%)",
    colorInputForeground: "hsl(220 20% 12%)",
    colorNeutral: "hsl(220 10% 90%)",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-gray-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none bg-gray-50/50",
    headerTitle: "text-2xl font-display font-bold tracking-tight text-gray-900",
    headerSubtitle: "text-sm text-gray-500",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "text-sm font-medium text-gray-700",
    footerActionLink: "font-medium text-[#F25C05] hover:text-[#D94E04]",
    footerActionText: "text-gray-500",
    dividerText: "text-xs text-gray-400 font-medium uppercase tracking-wider",
    identityPreviewEditButton: "text-[#F25C05] hover:text-[#D94E04]",
    formFieldSuccessText: "text-sm text-green-600",
    alertText: "text-sm font-medium text-red-600",
    logoBox: "h-12 flex items-center justify-center mb-6",
    logoImage: "h-10 w-auto object-contain",
    socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50 transition-colors",
    formButtonPrimary: "bg-[#F25C05] hover:bg-[#D94E04] text-white font-medium transition-colors",
    formFieldInput: "border-gray-200 focus:border-[#F25C05] focus:ring-[#F25C05] rounded-lg",
    footerAction: "py-4 text-center",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50 border border-red-100 rounded-lg p-3",
    otpCodeFieldInput: "border-gray-200 focus:border-[#F25C05] focus:ring-[#F25C05]",
    formFieldRow: "mb-4",
    main: "px-8 py-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClientInstance = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClientInstance.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClientInstance]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedRoutes() {
  return (
    <>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
      <Show when="signed-in">
        <AppLayout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            
            <Route path="/courses" component={Courses} />
            <Route path="/courses/:id" component={CourseDetail} />
            <Route path="/lessons/:id" component={LessonViewer} />
            
            <Route path="/cohorts" component={Cohorts} />
            <Route path="/cohorts/:id" component={CohortDetail} />
            
            <Route path="/assignments" component={Assignments} />
            <Route path="/assignments/:id" component={AssignmentDetail} />
            
            <Route path="/quizzes" component={Quizzes} />
            <Route path="/quizzes/:id" component={QuizDetail} />
            
            <Route path="/announcements" component={Announcements} />
            <Route path="/notifications" component={Notifications} />
            
            <Route path="/profile" component={Profile} />
            
            <Route path="/scholarship/apply" component={ScholarshipApply} />
            <Route path="/scholarship/status" component={ScholarshipStatus} />
            
            <Route path="/admin/scholarship-applications" component={AdminScholarships} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/admin/challenges" component={AdminChallenges} />

            {/* Phase 3 — Coding workspace & assessment */}
            <Route path="/challenges" component={Challenges} />
            <Route path="/challenges/:id" component={ChallengeDetail} />
            <Route path="/workspace" component={Workspace} />
            <Route path="/coding-progress" component={CodingProgress} />

            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access your learning hub",
          },
        },
        signUp: {
          start: {
            title: "Start your journey",
            subtitle: "Join the JOE Hub community",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={ProtectedRoutes} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
