import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl } from "@workspace/api-client-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { ReactNode } from "react";

// Configure API base URL
setBaseUrl("http://localhost:8080");

import NotFound from "@/pages/not-found";
import { LoginPage } from "@/pages/login";
import { ContactPage } from "@/pages/contact";
import { DashboardPage } from "@/pages/dashboard";
import { MattersPage } from "@/pages/matters";
import { MatterDetailPage } from "@/pages/matter-detail";
import { DebtorsPage } from "@/pages/debtors";
import { SchemesPage } from "@/pages/schemes";
import { DiaryPage } from "@/pages/diary";
import { DocumentsPage } from "@/pages/documents";
import { ReportsPage } from "@/pages/reports";
import { SettingsPage } from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/" component={HomeRedirect} />
        <Route path="/dashboard">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <DashboardPage />
          </ProtectedRoute>
        </Route>
        <Route path="/matters/:id">
          {(params) => (
            <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
              <MatterDetailPage id={params.id} />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/matters">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <MattersPage />
          </ProtectedRoute>
        </Route>
        <Route path="/debtors">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <DebtorsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/schemes">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <SchemesPage />
          </ProtectedRoute>
        </Route>
        <Route path="/diary">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <DiaryPage />
          </ProtectedRoute>
        </Route>
        <Route path="/documents">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <DocumentsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/reports">
          <ProtectedRoute roles={["ADMIN", "ATTORNEY", "COLLECTOR"]}>
            <ReportsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/settings">
          <ProtectedRoute roles={["ADMIN"]}>
            <SettingsPage />
          </ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
