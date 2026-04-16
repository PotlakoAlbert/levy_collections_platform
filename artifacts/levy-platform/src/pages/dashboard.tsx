import { useGetDashboardSummary, useGetDashboardOverdueTasks, useUpdateTask } from "@workspace/api-client-react";
import { formatCurrency, STAGE_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";
import { FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

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
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: overdueTasks, isLoading: isLoadingTasks } = useGetDashboardOverdueTasks();

  if (isLoadingSummary || isLoadingTasks) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!summary) return <div>Failed to load dashboard</div>;

  const chartData = summary.mattersByStage.map(stage => ({
    name: stage.stage,
    count: stage.count,
    totalOutstanding: stage.totalOutstanding,
    color: STAGE_CHART_COLORS[stage.stage] || "#94a3b8"
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <div className="flex gap-2">
          <Link href="/documents" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            <FileText className="mr-2 h-4 w-4" />
            Bulk Documents
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
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
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1">Life to date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Matters</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeMatters}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently open</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.overdueTasksCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
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
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 overflow-hidden flex flex-col">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b">
            <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Top Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {(!overdueTasks || overdueTasks.length === 0) ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No overdue tasks. Great job!</div>
            ) : (
              <div className="divide-y">
                {overdueTasks.map(task => (
                  <div key={task.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <Link href={`/matters/${task.matterId}`} className="text-sm font-semibold text-primary hover:underline">
                        {task.matterReference || "Unknown Matter"}
                      </Link>
                      <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                    </div>
                    <div className="text-sm font-medium mb-2">{task.title}</div>
                    <div className="flex items-center text-xs text-muted-foreground gap-4">
                      <span>Due: {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "N/A"}</span>
                      <span>Assignee: {task.assigneeName || "Unassigned"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
