import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Building2,
  CalendarCheck,
  FileText,
  BarChart3,
  Settings,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/matters", label: "Matters", icon: Briefcase, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/debtors", label: "Debtors", icon: Users, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/schemes", label: "Schemes", icon: Building2, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/diary", label: "Diary", icon: CalendarCheck, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/documents", label: "Documents", icon: FileText, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "ATTORNEY", "COLLECTOR"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
  { href: "/agent-portal", label: "Agent Portal", icon: Building2, roles: ["AGENT_VIEWER"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const filteredNav = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <aside className="w-64 flex flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-white">Levy<span className="text-primary-foreground/70">Connect</span></h1>
          <p className="text-xs text-sidebar-foreground/60 mt-1 uppercase tracking-wider font-semibold">Practice Management</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-sidebar-foreground/60")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-semibold text-sm">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">{user.name}</span>
              <span className="text-xs text-sidebar-foreground/60">{user.role}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
