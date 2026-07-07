import { useGetDashboardSummary, useGetDashboardOverdueTasks, useListSchemes } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { useState, useEffect } from "react";
import { formatCurrency, STAGE_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { Link } from "wouter";
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Archive, Zap, TrendingUp, 
  TrendingDown, Target, Gauge, Activity, AlertTriangle
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STAGE_CHART_COLORS: Record<string, string> = {
  LOD: "#3b82f6", // blue-500
  S129: "#eab308", // yellow-500
  SUMMONS: "#f97316", // orange-500
  JUDGMENT: "#ef4444", // red-500
  WRIT: "#a855f7", // purple-500
  RULE46: "#6366f1", // indigo-500
  SALE: "#f43f5e", // rose-500
  CLOSED: "#6b7280", // gray-500
};

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: overdueTasks, isLoading: isLoadingTasks } = useGetDashboardOverdueTasks();
  const { data: schemesData } = useListSchemes();
  const { toast } = useToast();

  async function archiveTask(taskId: string) {
    await customFetch(`/api/tasks/${taskId}/archive`, { method: "PATCH" });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overdue-tasks"] });
  }

  async function triggerAutomation(matterId: string) {
    try {
      await customFetch(`/api/test-automations/trigger-matter-created`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matterId }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overdue-tasks"] });
      toast({ title: "Automation triggered", description: "Automation started for the selected matter" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to trigger automation", variant: "destructive" });
    }
  }

  const [selectedClient, setSelectedClient] = useState<string | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined); // YYYY-MM
  const [filteredSummary, setFilteredSummary] = useState<any | null>(null);
  const [isFilteredLoading, setIsFilteredLoading] = useState(false);

  const schemes = Array.isArray(schemesData) ? schemesData : (schemesData as any)?.schemes ?? [];

  useEffect(() => {
    // If no filters selected, clear filteredSummary
    if (!selectedClient && !selectedMonth) {
      setFilteredSummary(null);
      return;
    }

    const load = async () => {
      setIsFilteredLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedClient) params.set("clientId", selectedClient);
        if (selectedMonth) {
          const [y, m] = selectedMonth.split("-");
          const from = new Date(Number(y), Number(m) - 1, 1).toISOString();
          const to = new Date(Number(y), Number(m), 0, 23, 59, 59).toISOString();
          params.set("from", from);
          params.set("to", to);
        }

        const url = `/api/dashboard/summary?${params.toString()}`;
        const json = await customFetch<any>(url, { method: "GET" });
        setFilteredSummary(json);
      } catch (e) {
        setFilteredSummary(null);
      } finally {
        setIsFilteredLoading(false);
      }
    };

    load();
  }, [selectedClient, selectedMonth]);

  if (isLoadingSummary || isLoadingTasks || isFilteredLoading) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!summary) return <div>Failed to load dashboard</div>;

  const display = filteredSummary ?? summary;
  const chartData = (display?.mattersByStage || []).map((stage: any) => ({
    name: stage.stage,
    count: stage.count,
    totalOutstanding: stage.totalOutstanding,
    color: STAGE_CHART_COLORS[stage.stage] || "#94a3b8"
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collections Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time view of levies, collections, and operational performance.</p>
        </div>
        <div className="flex gap-2 items-center">
          <select 
            className="rounded-md border px-3 py-2 text-sm bg-background" 
            value={selectedClient ?? ""} 
            onChange={(e) => setSelectedClient(e.target.value || undefined)}
          >
            <option value="">All clients</option>
            {schemes.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input 
            type="month" 
            value={selectedMonth ?? ""} 
            onChange={(e) => setSelectedMonth(e.target.value || undefined)} 
            className="rounded-md border px-3 py-2 text-sm bg-background"
            aria-label="Filter by month"
          />
          <Link href="/documents" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            <FileText className="mr-2 h-4 w-4" />
            Bulk Documents
          </Link>
        </div>
      </div>

      {/* 🎯 Critical Alerts & Exceptions */}
      {(summary.overdueTasksCount > 0 || (summary.totalOutstanding > 0 && summary.totalCollected === 0)) && (
        <div className="grid gap-4 md:grid-cols-2">
          {summary.overdueTasksCount > 0 && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base text-red-900 dark:text-red-100">{summary.overdueTasksCount} Overdue Tasks</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-800 dark:text-red-200 mb-3">Immediate action required on {summary.overdueTasksCount} overdue task{summary.overdueTasksCount !== 1 ? 's' : ''}.</p>
                <Link href="/diary" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium px-3 py-1.5 bg-red-600 text-white hover:bg-red-700">
                  View & Manage →
                </Link>
              </CardContent>
            </Card>
          )}
          
          {display?.mattersByStage?.some((s: any) => s.stage === 'JUDGMENT' && s.totalOutstanding > 0) && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-base text-orange-900 dark:text-orange-100">High-Risk Accounts</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                  {formatCurrency(display?.mattersByStage?.find((s: any) => s.stage === 'JUDGMENT')?.totalOutstanding || 0)} at judgment stage awaiting collection.
                </p>
                <Link href="/reports" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium px-3 py-1.5 bg-orange-600 text-white hover:bg-orange-700">
                  Review Aged Debtors →
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* The "Big Three" KPIs */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Financial Performance</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Levy Issuance Rate */}
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Issuance Rate</CardTitle>
                <Target className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{summary.activeMatters || 0}</div>
                <p className="text-xs text-muted-foreground">Active matters issued</p>
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>On track vs planned</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Levy Realisation Rate */}
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Realisation Rate</CardTitle>
                <Gauge className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {summary.totalCapital > 0 ? `${((summary.totalOutstanding / summary.totalCapital) * 100).toFixed(1)}%` : '0%'}
                </div>
                <p className="text-xs text-muted-foreground">Capital to outstanding ratio</p>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(summary.totalCapital)} capital vs {formatCurrency(summary.totalOutstanding)} outstanding
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Levy Collection Rate */}
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Collection Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">
                  {summary.totalCapital > 0 ? `${((summary.totalCollected / (summary.totalCapital + summary.totalCollected)) * 100).toFixed(1)}%` : '0%'}
                </div>
                <p className="text-xs text-muted-foreground">Collections vs capital issued</p>
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  {formatCurrency(summary.totalCollected)} collected
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Portfolio Overview</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalOutstanding)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Capital: {formatCurrency(summary.totalCapital)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCollected)}</div>
              <p className="text-xs text-muted-foreground mt-1">Life to date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Matters</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeMatters}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently open</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {summary.totalCapital > 0 ? `${((summary.totalCollected / (summary.totalCapital + summary.totalOutstanding)) * 100).toFixed(0)}%` : '0%'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs total portfolio</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Distribution of matters across collection stages</p>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => {
                      if (name === "count") return [value, "Matters"];
                      return [value, name];
                    }}
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 overflow-hidden flex flex-col">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-b pb-3">
            <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Critical Tasks
            </CardTitle>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Overdue tasks requiring immediate action</p>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {(!overdueTasks || overdueTasks.length === 0) ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p>No overdue tasks. Excellent progress!</p>
              </div>
            ) : (
              <div className="divide-y">
                {overdueTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="p-4 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start mb-1">
                      <Link href={`/matters/${task.matterId}`} className="text-sm font-semibold text-primary hover:underline line-clamp-1">
                        {task.matterReference || "Unknown Matter"}
                      </Link>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-muted-foreground"
                          onClick={() => archiveTask(task.id)}
                          title="Archive task"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-yellow-600"
                          onClick={() => triggerAutomation(task.matterId)}
                          title="Trigger automation"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-foreground mb-1 line-clamp-1">{task.title}</div>
                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{task.dueDate ? format(new Date(task.dueDate), "dd MMM") : "N/A"}</span>
                      <span>•</span>
                      <span>{task.assigneeName || "Unassigned"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {overdueTasks && overdueTasks.length > 5 && (
              <Link href="/diary" className="block p-4 text-center text-sm font-medium text-primary hover:bg-gray-50 dark:hover:bg-gray-800 border-t">
                View all {overdueTasks.length} overdue tasks →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
