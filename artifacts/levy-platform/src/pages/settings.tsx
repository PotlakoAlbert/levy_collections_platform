import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListUsers } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Shield } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  ATTORNEY: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  COLLECTOR: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  AGENT_VIEWER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function SettingsPage() {
  const { data, isLoading } = useListUsers();
  const users = (data as any)?.users ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and user management</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Users
              </CardTitle>
              <CardDescription>Manage platform users and roles</CardDescription>
            </div>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <div className="divide-y">
              {users.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {user.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={ROLE_COLORS[user.role] || ROLE_COLORS.AGENT_VIEWER}>
                      {user.role}
                    </Badge>
                    <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium">LevyConnect</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Jurisdiction</span>
            <span className="font-medium">South Africa</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Prescribed Interest Rate</span>
            <span className="font-medium">11.00% per annum</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Default Legislation</span>
            <span className="font-medium">Sectional Titles Act, NCA</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
