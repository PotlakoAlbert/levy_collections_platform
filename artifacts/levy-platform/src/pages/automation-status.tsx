import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { 
  Zap, Database, Clock, CheckCircle2, AlertCircle, Settings, 
  Workflow, FileText, Bot, DollarSign, Sliders, Eye, History, 
  Play, Lock, TrendingUp
} from "lucide-react";

interface QueueRow {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  paused: number;
}

export function AutomationStatusPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [queueNext, setQueueNext] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const automationStatus = await customFetch<any>("/api/health/automation-status", { method: "GET" });
      const queueNextData = await customFetch<any>("/api/health/automation/queue-next", { method: "GET" });
      setStatus(automationStatus);
      setQueueNext(queueNextData?.data ?? null);
    } catch (error) {
      toast({ title: "Error", description: "Unable to load automation status", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const renderQueueCounts = () => {
    if (!status?.queues) {
      return <p className="text-sm text-muted-foreground">No queue data available.</p>;
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(status.queues).map(([queueName, queueData]: any) => (
          <Card key={queueName}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">{queueName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Waiting</span>
                <span>{queueData.waiting}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active</span>
                <span>{queueData.active}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Completed</span>
                <span>{queueData.completed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Failed</span>
                <span>{queueData.failed}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderQueueNext = () => {
    if (!queueNext) {
      return <p className="text-sm text-muted-foreground">No next-job data available.</p>;
    }

    return (
      <div className="space-y-4">
        {Object.entries(queueNext).map(([queueName, jobs]: any) => (
          <Card key={queueName}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">{queueName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Waiting</p>
                  {jobs.waiting.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    jobs.waiting.map((job: any) => (
                      <div key={job.id} className="rounded border border-slate-200 p-3">
                        <p className="text-sm font-medium">{job.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {job.id}</p>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                  {jobs.active.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    jobs.active.map((job: any) => (
                      <div key={job.id} className="rounded border border-slate-200 p-3">
                        <p className="text-sm font-medium">{job.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {job.id}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automation Control Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">Centralized dashboard for managing all automation modules, rules, and system health.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadStatus} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh Status"}
          </Button>
        </div>
      </div>

      {/* System Health Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <p className="font-semibold">{status?.jobProcessingMode ?? "Unknown"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Queues Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              <p className="font-semibold">{status ? Object.keys(status.queues || {}).length : "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <p className="font-semibold">{status?.automationHealthCheck?.pendingJobCount ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="font-semibold">{status?.automationHealthCheck?.failedJobCount ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Core Automation Modules */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Core Automation Modules</h2>
          <p className="mt-1 text-sm text-muted-foreground">The most impactful automations for levy collection management.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Workflow & Task Management */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Workflow className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-base">Workflow & Task Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">Standardize new matter intake, document drafting, and payment approval. Automate task assignments and reminders.</p>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-foreground">Benefit:</p>
                <p className="text-xs text-muted-foreground mt-1">Reduces errors and ensures consistent, efficient levy processing</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Configure</Button>
            </CardContent>
          </Card>

          {/* Document Automation */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-base">Document Automation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">Generate levy notices, demand letters, and legal forms from templates with pre-populated client and matter data.</p>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-foreground">Benefit:</p>
                <p className="text-xs text-muted-foreground mt-1">Saves hours of drafting and eliminates manual data entry errors</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Configure</Button>
            </CardContent>
          </Card>

          {/* AI Collections Agent */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle className="text-base">AI Collections Agent</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">Intelligent agent that prioritizes tasks by payment risk and automates follow-up communications.</p>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-foreground">Benefit:</p>
                <p className="text-xs text-muted-foreground mt-1">Improves recovery rates by focusing efforts where needed most</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Configure</Button>
            </CardContent>
          </Card>

          {/* Billing & Invoicing */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-base">Automated Billing & Appeals</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">Create and validate bills (LEDES format supported). Automatically draft appeals for rejected invoices.</p>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-foreground">Benefit:</p>
                <p className="text-xs text-muted-foreground mt-1">Accelerates work-to-cash cycle and recovers revenue faster</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Configure</Button>
            </CardContent>
          </Card>

          {/* Dynamic Rule Engine */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2">
                  <Sliders className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle className="text-base">Dynamic Rule Engine</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">No-code rule engine that encodes firm policies (e.g., escalation thresholds, approval workflows).</p>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-foreground">Benefit:</p>
                <p className="text-xs text-muted-foreground mt-1">Ensures compliance and consistency with firm policies</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Configure</Button>
            </CardContent>
          </Card>

          {/* Accessibility & Testing */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2">
                  <Settings className="h-5 w-5 text-indigo-600" />
                </div>
                <CardTitle className="text-base">Automation Controls</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">Manage all automations with version control, audit trails, and safe testing modes.</p>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-foreground">Benefit:</p>
                <p className="text-xs text-muted-foreground mt-1">Minimizes production errors and maintains full audit compliance</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Configure</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Making Automations Accessible */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Making Automations Accessible</h2>
          <p className="mt-1 text-sm text-muted-foreground">No-code tools for administrators to create and manage automations without technical expertise.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Visual Rule Builder */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-base">Visual Rule Builder</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Drag-and-drop interface to define automation logic without writing code. Build complex workflows visually.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Flow charting interface</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Condition and trigger configuration</span>
                </li>
              </ul>
              <Button size="sm" className="w-full">Open Rule Builder</Button>
            </CardContent>
          </Card>

          {/* Rule Testing & Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">Rule Testing & Preview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Test automation rules in a safe environment before applying to live workflows with live execution preview.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Safe test mode for validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Live execution preview showing results</span>
                </li>
              </ul>
              <Button size="sm" className="w-full">Test Existing Rules</Button>
            </CardContent>
          </Card>

          {/* Version Control & Audit Trail */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-base">Version Control & Audit Trail</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Maintain complete history of all automation rule changes for compliance and understanding why processes changed.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Full change history and rollback</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Compliance audit trail with user tracking</span>
                </li>
              </ul>
              <Button size="sm" className="w-full">View Change History</Button>
            </CardContent>
          </Card>

          {/* Live Simulation Mode */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Live Simulation Mode</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Sandbox mode to run tests on production levy data without affecting live systems, minimizing production errors.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Sandbox with production data</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Zero impact on live workflows</span>
                </li>
              </ul>
              <Button size="sm" className="w-full">Start Simulation</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance & Insights */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Automation Performance & Insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">Real-time metrics on automation effectiveness and system health.</p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">Queue Status</CardTitle>
            </CardHeader>
            <CardContent>{renderQueueCounts()}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">Next Scheduled Jobs</CardTitle>
            </CardHeader>
            <CardContent>{renderQueueNext()}</CardContent>
          </Card>
        </div>
      </div>

      {/* Role-Based Access Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Role-Based Access Control</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Only administrators can create or modify automation rules. Other roles (Attorney, Collector) see automation results but cannot change underlying rules.
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
              <span><strong>ADMIN:</strong> Full access to create, modify, and delete automation rules</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
              <span><strong>ATTORNEY:</strong> View automation results and task lists only</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
              <span><strong>COLLECTOR:</strong> View automation results and task lists only</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
