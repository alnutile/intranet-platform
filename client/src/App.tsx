import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginPage } from "@/pages/Login";
import { RegisterPage } from "@/pages/Register";
import { Layout } from "@/pages/Layout";
import { DashboardPage } from "@/pages/Dashboard";
import { AdminPage } from "@/pages/Admin";
import { AdminAppsPage } from "@/pages/AdminApps";
import { AppHost } from "@/pages/AppHost";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, bootstrapped } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!bootstrapped) return <Navigate to="/register" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/apps" element={<AdminAppsPage />} />
            <Route path="/apps/:appId/*" element={<AppHost />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
