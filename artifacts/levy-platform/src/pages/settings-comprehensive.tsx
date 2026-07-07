import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter 
} from "@/components/ui/alert-dialog";
import { useListUsers, useCreateUser, useUpdateUser } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { 
  ChevronDown, UserPlus, Shield, Palette, Bell, Currency, Lock, FileText, 
  ToggleRight, Settings, Zap, HardDrive, AlertCircle, Download, Eye, Trash2,
  ChevronRight, CheckCircle2
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  ATTORNEY: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  COLLECTOR: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  VIEWER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

interface SettingsModule {
  id: string;
  title: string;
  icon: React.ReactNode;
  requiredRoles: string[];
}

// ============================================================================
// SETTINGS MODULES
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  requiredRole?: string;
  userRole?: string;
}

function CollapsibleSection({ 
  title, 
  icon, 
  description, 
  defaultOpen = false, 
  children,
  requiredRole = "ADMIN",
  userRole = "ADMIN"
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasAccess = !requiredRole || userRole === "ADMIN" || userRole === requiredRole;

  if (!hasAccess) {
    return (
      <Card className="opacity-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">{icon}</div>
              <div>
                <CardTitle className="text-sm">{title}</CardTitle>
                {description && <CardDescription className="text-xs">{description}</CardDescription>}
              </div>
            </div>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-primary">{icon}</div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
        </div>
      </CardHeader>
      {isOpen && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

// ============================================================================
// MODULE 1: LEVY & FEE CONFIGURATION
// ============================================================================

function LevyFeeModule() {
  const [levies, setLevies] = useState([
    { id: 1, name: "Strata Levy", type: "percentage", rate: 2.5, glCode: "4100", effective: "2026-01-01", clientId: "all" },
    { id: 2, name: "Maintenance Levy", type: "fixed", amount: 150, glCode: "4101", effective: "2026-01-01", clientId: "all" },
  ]);
  const [newLevy, setNewLevy] = useState({ name: "", type: "percentage", rate: 0, amount: 0, glCode: "", effective: "", clientId: "all" });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Levy Name</label>
          <Input value={newLevy.name} onChange={(e) => setNewLevy({ ...newLevy, name: e.target.value })} placeholder="e.g., Strata Levy" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Type</label>
          <Select value={newLevy.type} onValueChange={(v) => setNewLevy({ ...newLevy, type: v })}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage-based</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {newLevy.type === "percentage" ? (
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Rate (%)</label>
            <Input type="number" value={newLevy.rate} onChange={(e) => setNewLevy({ ...newLevy, rate: parseFloat(e.target.value) })} placeholder="2.5" className="mt-1" />
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Fixed Amount (ZAR)</label>
            <Input type="number" value={newLevy.amount} onChange={(e) => setNewLevy({ ...newLevy, amount: parseFloat(e.target.value) })} placeholder="150.00" className="mt-1" />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-muted-foreground">GL Account Code</label>
          <Input value={newLevy.glCode} onChange={(e) => setNewLevy({ ...newLevy, glCode: e.target.value })} placeholder="4100" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Effective Date</label>
          <Input type="date" value={newLevy.effective} onChange={(e) => setNewLevy({ ...newLevy, effective: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Applies To</label>
        <Select value={newLevy.clientId} onValueChange={(v) => setNewLevy({ ...newLevy, clientId: v })}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="client-1">Specific Client</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full">Add Levy Configuration</Button>

      <div className="space-y-2 mt-6 pt-6 border-t">
        <h4 className="font-semibold text-sm">Current Levy Configurations</h4>
        {levies.map((levy) => (
          <div key={levy.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50">
            <div className="flex-1">
              <div className="font-medium text-sm">{levy.name}</div>
              <div className="text-xs text-muted-foreground">GL Code: {levy.glCode} · {levy.type === "percentage" ? `${levy.rate}%` : formatCurrency(levy.amount)} · Active: {levy.effective}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost">Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive">Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 2: USER & ROLE MANAGEMENT
// ============================================================================

function UserRoleModule() {
  const { data, isLoading } = useListUsers();
  const users = (data as any)?.users ?? [];
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("COLLECTOR");

  const handleCreateUser = () => {
    if (!name || !email || !password) {
      toast({ title: "Validation", description: "All fields required", variant: "destructive" });
      return;
    }
    createUser.mutate({ data: { email, name, password, role } } as any, {
      onSuccess: () => {
        setName("");
        setEmail("");
        setPassword("");
        setRole("COLLECTOR");
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        toast({ title: "User created", description: `${name} was added successfully` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Role Definitions:</strong> ADMIN (full access), ATTORNEY (reports + cases), COLLECTOR (assigned matters only), VIEWER (read-only)
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 rounded-lg border bg-card">
        <h4 className="font-semibold text-sm">Add New User</h4>
        <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Assign Role</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin - Full Access</SelectItem>
              <SelectItem value="ATTORNEY">Attorney - Cases & Reports</SelectItem>
              <SelectItem value="COLLECTOR">Collector - Assigned Matters</SelectItem>
              <SelectItem value="VIEWER">Viewer - Read Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreateUser} className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      <div className="space-y-2 pt-4 border-t">
        <h4 className="font-semibold text-sm">Active Users</h4>
        {isLoading ? (
          <div className="flex justify-center py-4"><div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /></div>
        ) : (
          <div className="divide-y">
            {users.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    {user.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ROLE_COLORS[user.role] || ROLE_COLORS.VIEWER}>{user.role}</Badge>
                  <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 3: BRANDING & UI
// ============================================================================

function BrandingModule() {
  const [brandColor, setBrandColor] = useState("#ef4444");
  const [firmName, setFirmName] = useState(" Attorneys");
  const [logoUrl, setLogoUrl] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Firm Name</label>
        <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="Your Firm Name" className="mt-1" />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Brand Color (Hex)</label>
        <div className="flex gap-2 mt-1">
          <Input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#ef4444" />
          <div 
            className="w-10 h-10 rounded-lg border-2 border-gray-300" 
            style={{ backgroundColor: brandColor }}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Firm Logo URL</label>
        <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
        {logoUrl && (
          <div className="mt-2 p-2 rounded border flex items-center justify-center h-20 bg-muted/20">
            <img src={logoUrl} alt="Logo preview" className="max-h-16 max-w-32 object-contain" />
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Navigation Label Order</label>
        <div className="space-y-2 mt-2">
          {["Dashboard", "Matters", "Debtors", "Reports", "Schemes", "Automation", "Settings"].map((item) => (
            <div key={item} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-700">
              <ToggleRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1">{item}</span>
              <Button size="sm" variant="ghost">↑</Button>
              <Button size="sm" variant="ghost">↓</Button>
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full">Save Branding Changes</Button>
    </div>
  );
}

// ============================================================================
// MODULE 4: NOTIFICATIONS & COMMUNICATION
// ============================================================================

function NotificationModule() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  const triggers = [
    { id: "levy_issued", label: "Levy Notice Issued", icon: "📋" },
    { id: "payment_received", label: "Payment Received", icon: "💰" },
    { id: "levy_changed", label: "Levy Status Changed", icon: "🔄" },
    { id: "matter_escalated", label: "Matter Escalated", icon: "⚠️" },
    { id: "arrangement_made", label: "Arrangement Made", icon: "✅" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-sm mb-3">Communication Channels</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3 flex-1">
              <Bell className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium text-sm">Email Notifications</div>
                <div className="text-xs text-muted-foreground">Send via SMTP</div>
              </div>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3 flex-1">
              <Bell className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium text-sm">WhatsApp Notifications</div>
                <div className="text-xs text-muted-foreground">Via Meta Business API</div>
              </div>
            </div>
            <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3 flex-1">
              <Bell className="h-4 w-4 text-purple-500" />
              <div>
                <div className="font-medium text-sm">SMS Notifications</div>
                <div className="text-xs text-muted-foreground">Via Twilio / Local Provider</div>
              </div>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <h4 className="font-semibold text-sm mb-3">Notification Triggers</h4>
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <div key={trigger.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <span className="text-lg">{trigger.icon}</span>
                <span className="text-sm font-medium">{trigger.label}</span>
              </div>
              <Switch defaultChecked={true} />
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full">Save Notification Settings</Button>
    </div>
  );
}

// ============================================================================
// MODULE 5: AUDIT LOGS
// ============================================================================

function AuditLogsModule() {
  const [logs] = useState([
    { id: 1, user: "Admin User", action: "Created levy configuration", target: "Strata Levy", timestamp: "2026-06-25 10:30 AM", severity: "info" },
    { id: 2, user: "Collector", action: "Updated matter stage", target: "MATTER-001", timestamp: "2026-06-25 09:15 AM", severity: "info" },
    { id: 3, user: "Admin User", action: "Changed user role", target: "John Doe", timestamp: "2026-06-24 04:45 PM", severity: "warning" },
    { id: 4, user: "System", action: "Payment processing", target: "PAYMENT-5821", timestamp: "2026-06-24 02:30 PM", severity: "info" },
  ]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-card">
        <h4 className="font-semibold text-sm mb-3">Compliance & Audit Trail</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Complete audit trail of all system changes for compliance and accountability
        </p>
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50">
              <div className="flex-1">
                <div className="font-medium text-sm">{log.action}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {log.user} · {log.target} · {log.timestamp}
                </div>
              </div>
              <Badge variant={log.severity === "warning" ? "destructive" : "secondary"} className="text-xs">
                {log.severity}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <Button variant="outline" className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Export Audit Log (CSV)
      </Button>
    </div>
  );
}

// ============================================================================
// MODULE 6: TEST ENVIRONMENT / SANDBOX
// ============================================================================

function TestEnvironmentModule() {
  const [sandboxMode, setSandboxMode] = useState(false);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Sandbox Mode:</strong> Test configuration changes without affecting live data. All transactions will be marked as test and excluded from reports.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div>
          <div className="font-semibold text-sm">Enable Sandbox Mode</div>
          <div className="text-xs text-muted-foreground">Test new levies and rules safely</div>
        </div>
        <Switch checked={sandboxMode} onCheckedChange={setSandboxMode} />
      </div>

      {sandboxMode && (
        <div className="space-y-2 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/30">
          <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-300">Sandbox Testing Options</h4>
          <Button variant="outline" className="w-full">Test Levy Calculation</Button>
          <Button variant="outline" className="w-full">Test Payment Processing</Button>
          <Button variant="outline" className="w-full">Preview Notifications</Button>
          <Button variant="outline" className="w-full">Test Matter Escalation</Button>
        </div>
      )}

      <div className="pt-4 border-t">
        <h4 className="font-semibold text-sm mb-3">System Diagnostics</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm">Database Connection</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm">Email Service</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Active</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm">WhatsApp API</span>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Mock Mode</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm">Job Queue (BullMQ)</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================

export function SettingsComprehensivePage() {
  const [activeTab, setActiveTab] = useState("levy");
  const userRole = "ADMIN"; // TODO: Get from auth context

  const modules: SettingsModule[] = [
    { id: "levy", title: "Levy & Fee Configuration", icon: <Currency className="h-5 w-5" />, requiredRoles: ["ADMIN"] },
    { id: "users", title: "Users & Roles", icon: <Shield className="h-5 w-5" />, requiredRoles: ["ADMIN"] },
    { id: "branding", title: "Branding & UI", icon: <Palette className="h-5 w-5" />, requiredRoles: ["ADMIN"] },
    { id: "notifications", title: "Notifications", icon: <Bell className="h-5 w-5" />, requiredRoles: ["ADMIN"] },
    { id: "audit", title: "Audit Logs", icon: <FileText className="h-5 w-5" />, requiredRoles: ["ADMIN"] },
    { id: "sandbox", title: "Test Environment", icon: <HardDrive className="h-5 w-5" />, requiredRoles: ["ADMIN"] },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Mission-critical configuration hub for firm operations</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 md:p-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-2">
              <h3 className="font-semibold text-sm px-2 text-muted-foreground uppercase tracking-wider">Modules</h3>
              {modules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setActiveTab(module.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === module.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {module.icon}
                  <span>{module.title}</span>
                  {userRole !== "ADMIN" && module.requiredRoles[0] === "ADMIN" && (
                    <Lock className="h-3 w-3 ml-auto" />
                  )}
                </button>
              ))}
            </div>

            {/* Quick Info Card */}
            <div className="mt-8 p-4 rounded-lg border bg-card">
              <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Your Role</div>
              <Badge className={`${ROLE_COLORS[userRole] || ROLE_COLORS.VIEWER} w-full text-center justify-center py-1`}>
                {userRole}
              </Badge>
              <div className="text-xs text-muted-foreground mt-3">
                {userRole === "ADMIN" 
                  ? "You have full access to all settings"
                  : "You have limited access to this section"}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {activeTab === "levy" && (
              <CollapsibleSection
                title="💰 Levy Types & Rates"
                icon={<Currency className="h-5 w-5" />}
                description="Create and manage levy types with percentage or fixed amounts"
                defaultOpen={true}
                userRole={userRole}
              >
                <LevyFeeModule />
              </CollapsibleSection>
            )}

            {activeTab === "users" && (
              <CollapsibleSection
                title="👥 User & Role Management"
                icon={<Shield className="h-5 w-5" />}
                description="Manage team members and their access levels"
                defaultOpen={true}
                userRole={userRole}
              >
                <UserRoleModule />
              </CollapsibleSection>
            )}

            {activeTab === "branding" && (
              <CollapsibleSection
                title="🎨 Branding & UI Customization"
                icon={<Palette className="h-5 w-5" />}
                description="Customize firm branding and interface appearance"
                defaultOpen={true}
                userRole={userRole}
              >
                <BrandingModule />
              </CollapsibleSection>
            )}

            {activeTab === "notifications" && (
              <CollapsibleSection
                title="🔔 Notifications & Communication"
                icon={<Bell className="h-5 w-5" />}
                description="Configure automated notifications and communication channels"
                defaultOpen={true}
                userRole={userRole}
              >
                <NotificationModule />
              </CollapsibleSection>
            )}

            {activeTab === "audit" && (
              <CollapsibleSection
                title="📋 Audit Logs & Compliance"
                icon={<FileText className="h-5 w-5" />}
                description="Track all system changes for compliance and accountability"
                defaultOpen={true}
                userRole={userRole}
              >
                <AuditLogsModule />
              </CollapsibleSection>
            )}

            {activeTab === "sandbox" && (
              <CollapsibleSection
                title="🧪 Test Environment & Diagnostics"
                icon={<HardDrive className="h-5 w-5" />}
                description="Test new configurations before applying to live environment"
                defaultOpen={true}
                userRole={userRole}
              >
                <TestEnvironmentModule />
              </CollapsibleSection>
            )}

            {/* Additional Info Cards */}
            {activeTab === "levy" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    GL Account Mapping Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>• 4100: Strata Levies</p>
                    <p>• 4101: Maintenance Levies</p>
                    <p>• 4102: Special Levies</p>
                    <p>Ensure each levy is mapped to correct GL account for accurate financial reporting</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsComprehensivePage;
