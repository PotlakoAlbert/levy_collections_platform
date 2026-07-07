// ============================================================================
// Settings Page - Mission-Critical Configuration Hub
// ============================================================================
// Re-export the comprehensive, modular settings page which includes:
// - Levy & Fee Configuration (GL mapping, percentage/fixed rates)
// - User & Role Management (ADMIN, ATTORNEY, COLLECTOR, VIEWER)
// - Branding & UI Customization (logos, colors, navigation)
// - Notifications & Communication (email, WhatsApp, SMS triggers)
// - Audit Logs & Compliance (full change tracking)
// - Test Environment / Sandbox Mode (safe testing)
// ============================================================================

export { SettingsComprehensivePage as SettingsPage } from "./settings-comprehensive";

// Legacy exports for backward compatibility
import { SettingsComprehensivePage } from "./settings-comprehensive";
const SettingsPageLegacy = SettingsComprehensivePage;

export default SettingsPageLegacy;

// ============================================================================
// OLD CODE PRESERVED BELOW (for reference, can be removed)
// ============================================================================

/*
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListUsers, useCreateUser, useUpdateUser } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { UserPlus, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  ATTORNEY: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  COLLECTOR: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  AGENT_VIEWER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function SettingsPageLegacy() {
  const { data, isLoading } = useListUsers();
  const users = (data as any)?.users ?? [];
  const createUser = useCreateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("COLLECTOR");
  const [editingUser, setEditingUser] = React.useState<any | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [editRole, setEditRole] = React.useState("COLLECTOR");
  const updateUser = useUpdateUser();

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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Add User</AlertDialogTitle>
                    <AlertDialogDescription>Create a new platform user</AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-3 mt-2">
                    <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Role</label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="w-48 h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                          <SelectItem value="ATTORNEY">ATTORNEY</SelectItem>
                          <SelectItem value="COLLECTOR">COLLECTOR</SelectItem>
                          <SelectItem value="AGENT_VIEWER">AGENT_VIEWER</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      createUser.mutate({ data: { email, name, password, role } } as any, {
                        onSuccess: () => {
                          setName("");
                          setEmail("");
                          setPassword("");
                          setRole("COLLECTOR");
                          queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                          toast({ title: "User created", description: `${name} was created.` });
                        },
                        onError: () => {
                          toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
                        }
                      });
                    }}>Create</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" onClick={() => { setEditName(user.name); setEditEmail(user.email); setEditRole(user.role ?? "COLLECTOR"); setEditPassword(""); }}>Edit</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Edit User</AlertDialogTitle>
                          <AlertDialogDescription>Update user details</AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-3 mt-2">
                          <Input placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                          <Input placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                          <Input placeholder="Password (leave blank to keep)" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">Role</label>
                            <Select value={editRole} onValueChange={setEditRole}>
                              <SelectTrigger className="w-48 h-8 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                                <SelectItem value="ATTORNEY">ATTORNEY</SelectItem>
                                <SelectItem value="COLLECTOR">COLLECTOR</SelectItem>
                                <SelectItem value="AGENT_VIEWER">AGENT_VIEWER</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                            updateUser.mutate({ id: user.id, data: { name: editName, email: editEmail, password: editPassword || undefined, role: editRole } } as any, {
                              onSuccess: () => {
                                queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                                setEditingUser(null);
                                toast({ title: 'Updated', description: 'User updated' });
                              },
                              onError: () => {
                                toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' });
                              }
                            });
                          }}>Save</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete this user?')) return;
                      try {
                        await customFetch(`/api/users/${user.id}`, { method: 'DELETE' });
                        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                        toast({ title: 'Deleted', description: 'User deleted' });
                      } catch (err) {
                        toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
                      }
                    }}>Delete</Button>
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
*/
