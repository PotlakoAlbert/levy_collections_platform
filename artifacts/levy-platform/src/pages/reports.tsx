import { useMemo, useState, useEffect } from "react";
import {
  useGetPipelineSummary,
  useGetCollectionsByAgent,
  useGetAgedDebtorsReport,
  useListPayments,
  useListSchemes,
  useListAgents,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { formatCurrency, STAGE_COLORS, STAGE_HEX_COLORS, cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
  Line,
} from "recharts";
import { Link } from "wouter";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  Wallet,
  Users,
  AlertTriangle,
  Target,
  Printer,
} from "lucide-react";
import {
  format,
  subDays,
  startOfYear,
  isWithinInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  endOfDay,
} from "date-fns";
import type { AgedDebtorRow } from "@workspace/api-zod";

type Timeframe = "7d" | "30d" | "90d" | "ytd" | "all";

const AGING_BUCKETS = [
  { key: "bucket0to30", label: "0–30 days", color: "#22c55e" },
  { key: "bucket31to60", label: "31–60 days", color: "#eab308" },
  { key: "bucket61to90", label: "61–90 days", color: "#f97316" },
  { key: "bucket91to120", label: "91–120 days", color: "#ef4444" },
  { key: "bucket120plus", label: "120+ days", color: "#991b1b" },
] as const;

const pipelineChartConfig = {
  count: { label: "Matters", color: STAGE_HEX_COLORS.LOD },
  outstanding: { label: "Outstanding", color: "#6366f1" },
} satisfies ChartConfig;

const collectionsChartConfig = {
  collected: { label: "Collected", color: "#22c55e" },
  outstanding: { label: "Outstanding", color: "#f97316" },
} satisfies ChartConfig;

const trendChartConfig = {
  amount: { label: "Collections", color: "#3b82f6" },
} satisfies ChartConfig;

const agingChartConfig = Object.fromEntries(
  AGING_BUCKETS.map((b) => [b.key, { label: b.label, color: b.color }])
) satisfies ChartConfig;

function getDateRange(tf: Timeframe): { from: Date | null; to: Date } {
  const to = endOfDay(new Date());
  if (tf === "all") return { from: null, to };
  if (tf === "ytd") return { from: startOfYear(to), to };
  const days = tf === "7d" ? 7 : tf === "30d" ? 30 : 90;
  return { from: subDays(to, days), to };
}

function aggregateAging(rows: AgedDebtorRow[]) {
  return AGING_BUCKETS.map((bucket) => {
    const total = rows.reduce(
      (sum, row) => sum + (row[bucket.key as keyof AgedDebtorRow] as number || 0),
      0
    );
    const count = rows.filter(
      (row) => (row[bucket.key as keyof AgedDebtorRow] as number) > 0
    ).length;
    return {
      name: bucket.label,
      key: bucket.key,
      value: total,
      count,
      fill: bucket.color,
    };
  }).filter((b) => b.value > 0);
}

function buildCollectionTrend(
  payments: { amount: number; receivedDate: string }[],
  tf: Timeframe
) {
  const { from, to } = getDateRange(tf);
  const start = from ?? subDays(to, 90);
  const filtered = payments.filter((p) => {
    const d = new Date(p.receivedDate);
    return isWithinInterval(d, { start, end: to });
  });

  if (tf === "7d" || tf === "30d") {
    const days = eachDayOfInterval({ start, end: to });
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const amount = filtered
        .filter((p) => format(new Date(p.receivedDate), "yyyy-MM-dd") === key)
        .reduce((s, p) => s + p.amount, 0);
      return { period: format(day, "dd MMM"), amount };
    });
  }

  if (tf === "90d") {
    const weeks = eachWeekOfInterval({ start, end: to }, { weekStartsOn: 1 });
    return weeks.map((weekStart) => {
      const weekEnd = subDays(
        new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        1
      );
      const amount = filtered
        .filter((p) => {
          const d = new Date(p.receivedDate);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((s, p) => s + p.amount, 0);
      return { period: `W/C ${format(weekStart, "dd MMM")}`, amount };
    });
  }

  const months = eachMonthOfInterval({ start, end: to });
  return months.map((month) => {
    const amount = filtered
      .filter((p) => format(new Date(p.receivedDate), "yyyy-MM") === format(month, "yyyy-MM"))
      .reduce((s, p) => s + p.amount, 0);
    return { period: format(month, "MMM yyyy"), amount };
  });
}

function buildInsights(
  summary: {
    totalOutstanding: number;
    totalCollected: number;
    totalCapital: number;
    activeMatters: number;
    overdueTasksCount: number;
  } | null,
  aging: ReturnType<typeof aggregateAging>,
  collections: { agentName: string; totalCollected: number; totalOutstanding: number }[],
  periodCollected: number,
  prevPeriodCollected: number
) {
  const insights: { text: string; tone: "positive" | "warning" | "neutral" | "info" }[] = [];

  if (summary) {
    const rate = summary.totalCapital > 0
      ? (summary.totalCollected / summary.totalCapital) * 100
      : 0;
    insights.push({
      text: `Portfolio recovery rate is ${rate.toFixed(1)}% — ${formatCurrency(summary.totalCollected)} collected against ${formatCurrency(summary.totalCapital)} capital.`,
      tone: rate >= 30 ? "positive" : rate >= 15 ? "neutral" : "warning",
    });

    if (summary.overdueTasksCount > 0) {
      insights.push({
        text: `${summary.overdueTasksCount} overdue task${summary.overdueTasksCount !== 1 ? "s" : ""} need attention — review the Diary to clear or archive them.`,
        tone: "warning",
      });
    }
  }

  const risky = aging.find((b) => b.key === "bucket120plus");
  if (risky && risky.value > 0) {
    insights.push({
      text: `${formatCurrency(risky.value)} sits in the 120+ day aging bucket across ${risky.count} matter${risky.count !== 1 ? "s" : ""} — prioritise escalation.`,
      tone: "warning",
    });
  }

  if (collections.length > 0) {
    const top = [...collections].sort((a, b) => b.totalCollected - a.totalCollected)[0];
    if (top.totalCollected > 0) {
      insights.push({
        text: `${top.agentName} leads collections with ${formatCurrency(top.totalCollected)} recovered across the portfolio.`,
        tone: "positive",
      });
    }
  }

  if (periodCollected > 0 || prevPeriodCollected > 0) {
    const delta = prevPeriodCollected > 0
      ? ((periodCollected - prevPeriodCollected) / prevPeriodCollected) * 100
      : periodCollected > 0 ? 100 : 0;
    const dir = delta >= 0 ? "up" : "down";
    insights.push({
      text: `Collections ${dir} ${Math.abs(delta).toFixed(0)}% vs the previous period (${formatCurrency(periodCollected)} this period).`,
      tone: delta >= 0 ? "positive" : "warning",
    });
  }

  return insights.slice(0, 4);
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
      <div className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <CardContent className="pt-5 pb-4 pl-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [schemeFilter, setSchemeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [filteredSummary, setFilteredSummary] = useState<{
    totalOutstanding: number;
    totalCollected: number;
    totalCapital: number;
    activeMatters: number;
    overdueTasksCount: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const reportParams = {
    ...(agentFilter !== "all" ? { agentId: agentFilter } : {}),
    ...(schemeFilter !== "all" ? { schemeId: schemeFilter } : {}),
  };

  const { data: stageSummary, isLoading: stageLoading } = useGetPipelineSummary();
  const { data: collections, isLoading: collectionsLoading } = useGetCollectionsByAgent();
  const { data: agingRaw, isLoading: agingLoading } = useGetAgedDebtorsReport(reportParams);
  const { data: paymentsRaw, isLoading: paymentsLoading } = useListPayments();
  const { data: schemesData } = useListSchemes();
  const { data: agentsData } = useListAgents();

  const schemes = Array.isArray(schemesData) ? schemesData : (schemesData as { schemes?: unknown[] })?.schemes ?? [];
  const agents = Array.isArray(agentsData) ? agentsData : [];

  const stageData = (stageSummary as { stage: string; count: number; totalOutstanding: number; totalCapital: number }[]) ?? [];
  const collectionData = (collections as { agentId: string; agentName: string; totalMatters: number; totalCapital: number; totalCollected: number; totalOutstanding: number; mattersPerStage: Record<string, number> }[]) ?? [];
  const agingRows = (agingRaw as AgedDebtorRow[]) ?? [];
  const payments = (paymentsRaw as { amount: number; receivedDate: string }[]) ?? [];

  const { from, to } = getDateRange(timeframe);

  useEffect(() => {
    if (timeframe === "all" && schemeFilter === "all") {
      setFilteredSummary(null);
      return;
    }
    const load = async () => {
      setSummaryLoading(true);
      try {
        const params = new URLSearchParams();
        if (schemeFilter !== "all") params.set("clientId", schemeFilter);
        if (from) params.set("from", from.toISOString());
        params.set("to", to.toISOString());
        const json = await customFetch<typeof filteredSummary>(
          `/api/dashboard/summary?${params.toString()}`,
          { method: "GET" }
        );
        setFilteredSummary(json);
      } catch {
        setFilteredSummary(null);
      } finally {
        setSummaryLoading(false);
      }
    };
    load();
  }, [timeframe, schemeFilter, from?.toISOString(), to.toISOString()]);

  const baseSummary = useMemo(() => {
    const totalOutstanding = stageData.reduce((s, r) => s + (r.totalOutstanding || 0), 0);
    const totalCapital = stageData.reduce((s, r) => s + (r.totalCapital || 0), 0);
    const totalCollected = collectionData.reduce((s, r) => s + (r.totalCollected || 0), 0);
    const activeMatters = stageData.reduce((s, r) => s + (r.count || 0), 0) - (stageData.find((r) => r.stage === "CLOSED")?.count || 0);
    return {
      totalOutstanding,
      totalCapital,
      totalCollected,
      activeMatters: Math.max(0, activeMatters),
      overdueTasksCount: 0,
    };
  }, [stageData, collectionData]);

  const summary = filteredSummary ?? baseSummary;

  const agingChartData = useMemo(() => aggregateAging(agingRows), [agingRows]);
  const collectionTrend = useMemo(() => buildCollectionTrend(payments, timeframe), [payments, timeframe]);

  const periodPayments = useMemo(() => {
    if (!from) return payments.reduce((s, p) => s + p.amount, 0);
    return payments
      .filter((p) => isWithinInterval(new Date(p.receivedDate), { start: from, end: to }))
      .reduce((s, p) => s + p.amount, 0);
  }, [payments, from, to]);

  const prevPeriodPayments = useMemo(() => {
    if (!from) return 0;
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const prevTo = new Date(from.getTime() - 1);
    return payments
      .filter((p) => isWithinInterval(new Date(p.receivedDate), { start: prevFrom, end: prevTo }))
      .reduce((s, p) => s + p.amount, 0);
  }, [payments, from, to]);

  const insights = useMemo(
    () => buildInsights(summary, agingChartData, collectionData, periodPayments, prevPeriodPayments),
    [summary, agingChartData, collectionData, periodPayments, prevPeriodPayments]
  );

  const topDebtors = useMemo(
    () => [...agingRows].sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 10),
    [agingRows]
  );

  const recoveryRate = summary.totalCapital > 0
    ? (summary.totalCollected / summary.totalCapital) * 100
    : 0;

  const isLoading = stageLoading || collectionsLoading || agingLoading || paymentsLoading || summaryLoading;

  const insightToneClass = {
    positive: "border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
    warning: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
    neutral: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
    info: "border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20",
  };

  function handleExportCsv() {
    const rows = agingRows.map((r) => ({
      reference: r.reference,
      debtor: r.debtorName,
      scheme: r.schemeName,
      agent: r.agentName ?? "",
      stage: r.stage,
      outstanding: r.totalOutstanding,
      capital: r.capitalArrears,
      interest: r.interest,
      legalCosts: r.legalCosts,
    }));
    downloadCsv(`levy-aged-debtors-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
  }

  function handleExportCollectionsCsv() {
    const rows = collectionData.map((r) => ({
      agent: r.agentName,
      matters: r.totalMatters,
      collected: r.totalCollected,
      outstanding: r.totalOutstanding,
      capital: r.totalCapital ?? 0,
    }));
    downloadCsv(`levy-collections-by-agent-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
  }

  return (
    <div className="space-y-6 pb-8 print:space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-lg print:bg-white print:text-black print:border print:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-300 print:text-muted-foreground">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm font-medium">Portfolio Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Reports & Analytics</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl print:text-muted-foreground">
              Interactive insights for collection managers and attorneys — drill into pipeline, collections, and aging data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="secondary" size="sm" onClick={handleExportCsv} className="bg-white/10 hover:bg-white/20 text-white border-0">
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCollectionsCsv} className="bg-white/10 hover:bg-white/20 text-white border-0">
              <Download className="h-4 w-4 mr-1.5" />
              Agent CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 text-white border-0">
              <Printer className="h-4 w-4 mr-1.5" />
              Print / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center print:hidden">
        <ToggleGroup
          type="single"
          value={timeframe}
          onValueChange={(v) => v && setTimeframe(v as Timeframe)}
          className="bg-muted rounded-lg p-1"
        >
          {(["7d", "30d", "90d", "ytd", "all"] as Timeframe[]).map((tf) => (
            <ToggleGroupItem key={tf} value={tf} className="text-xs px-3 data-[state=on]:bg-background">
              {tf === "ytd" ? "YTD" : tf === "all" ? "All time" : tf.toUpperCase()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a: { id: string; name: string }) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={schemeFilter} onValueChange={setSchemeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All schemes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schemes</SelectItem>
            {schemes.map((s: { id: string; name: string }) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Outstanding"
              value={formatCurrency(summary.totalOutstanding)}
              subtitle={`${summary.activeMatters} active matters`}
              icon={Wallet}
              accent="bg-red-500"
            />
            <KpiCard
              title="Total Collected"
              value={formatCurrency(summary.totalCollected)}
              subtitle={timeframe !== "all" ? `${formatCurrency(periodPayments)} in selected period` : "Life to date"}
              icon={TrendingUp}
              accent="bg-green-500"
            />
            <KpiCard
              title="Recovery Rate"
              value={`${recoveryRate.toFixed(1)}%`}
              subtitle="Collected vs capital arrears"
              icon={Target}
              accent="bg-blue-500"
            />
            <KpiCard
              title="Agents Active"
              value={String(collectionData.filter((c) => c.totalMatters > 0).length)}
              subtitle={`${agingRows.length} matters in aging report`}
              icon={Users}
              accent="bg-purple-500"
            />
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3 rounded-lg border border-l-4 p-4 text-sm",
                    insightToneClass[insight.tone]
                  )}
                >
                  <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
                  <p>{insight.text}</p>
                </div>
              ))}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="print:hidden">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="collections">Collections</TabsTrigger>
              <TabsTrigger value="aging">Aging</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Collection Trend</CardTitle>
                    <CardDescription>Payments received over the selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={trendChartConfig} className="h-[260px] w-full">
                      <AreaChart data={collectionTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                        <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="url(#fillAmount)" strokeWidth={2} />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Debtor Aging Distribution</CardTitle>
                    <CardDescription>Outstanding balance by days since LOD</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {agingChartData.length === 0 ? (
                      <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No aging data</div>
                    ) : (
                      <ChartContainer config={agingChartConfig} className="h-[260px] w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                          <Pie
                            data={agingChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {agingChartData.map((entry) => (
                              <Cell key={entry.key} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartLegend content={<ChartLegendContent />} />
                        </PieChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Outstanding Matters</CardTitle>
                  <CardDescription>Highest-value accounts requiring attention</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Debtor</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDebtors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data</TableCell>
                        </TableRow>
                      ) : (
                        topDebtors.map((row) => (
                          <TableRow key={row.matterId}>
                            <TableCell>
                              <Link href={`/matters/${row.matterId}`} className="font-mono text-primary hover:underline text-xs">
                                {row.reference}
                              </Link>
                            </TableCell>
                            <TableCell className="font-medium">{row.debtorName}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-[10px]", STAGE_COLORS[row.stage])}>{row.stage}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.totalOutstanding)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PIPELINE */}
            <TabsContent value="pipeline" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base">Pipeline Composition</CardTitle>
                    <CardDescription>Matter count and outstanding value per litigation stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={pipelineChartConfig} className="h-[320px] w-full">
                      <ComposedChart data={stageData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) =>
                                name === "count" ? [value, "Matters"] : [formatCurrency(Number(value)), "Outstanding"]
                              }
                            />
                          }
                        />
                        <Bar yAxisId="left" dataKey="count" radius={[4, 4, 0, 0]}>
                          {stageData.map((entry) => (
                            <Cell key={entry.stage} fill={STAGE_HEX_COLORS[entry.stage] || "#94a3b8"} />
                          ))}
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="totalOutstanding" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="outstanding" />
                      </ComposedChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Stage Breakdown</CardTitle>
                    <CardDescription>Outstanding by stage</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[320px] overflow-y-auto">
                    {[...stageData]
                      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
                      .map((row) => {
                        const max = Math.max(...stageData.map((s) => s.totalOutstanding), 1);
                        return (
                          <div key={row.stage} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <Badge className={cn("text-[10px]", STAGE_COLORS[row.stage])}>{row.stage}</Badge>
                              <span className="font-semibold tabular-nums">{formatCurrency(row.totalOutstanding)}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (row.totalOutstanding / max) * 100)}%`,
                                  backgroundColor: STAGE_HEX_COLORS[row.stage] || "#94a3b8",
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{row.count} matter{row.count !== 1 ? "s" : ""}</p>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* COLLECTIONS */}
            <TabsContent value="collections" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Collections by Managing Agent</CardTitle>
                  <CardDescription>Compare recovered amounts against outstanding balances</CardDescription>
                </CardHeader>
                <CardContent>
                  {collectionData.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No collection data yet</div>
                  ) : (
                    <ChartContainer config={collectionsChartConfig} className="h-[340px] w-full">
                      <BarChart data={collectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="agentName" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="totalCollected" fill="#22c55e" radius={[4, 4, 0, 0]} name="collected" />
                        <Bar dataKey="totalOutstanding" fill="#f97316" radius={[4, 4, 0, 0]} name="outstanding" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {collectionData.map((agent) => {
                  const rate = agent.totalCapital > 0
                    ? (agent.totalCollected / agent.totalCapital) * 100
                    : 0;
                  return (
                    <Card key={agent.agentId}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">{agent.agentName}</CardTitle>
                        <CardDescription>{agent.totalMatters} matters</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Collected</span>
                          <span className="font-semibold text-green-600">{formatCurrency(agent.totalCollected)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Outstanding</span>
                          <span className="font-semibold">{formatCurrency(agent.totalOutstanding)}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {rate >= 25 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className="text-xs text-muted-foreground">{rate.toFixed(0)}% recovery rate</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* AGING */}
            <TabsContent value="aging" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Aging Buckets</CardTitle>
                    <CardDescription>Tap segments for exact values</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={agingChartConfig} className="h-[300px] w-full">
                      <BarChart data={agingChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v))} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {agingChartData.map((entry) => (
                            <Cell key={entry.key} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Risk Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {AGING_BUCKETS.map((bucket) => {
                      const data = agingChartData.find((b) => b.key === bucket.key);
                      const total = agingChartData.reduce((s, b) => s + b.value, 0);
                      const pct = total > 0 && data ? (data.value / total) * 100 : 0;
                      return (
                        <div key={bucket.key} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucket.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{bucket.label}</span>
                              <span className="tabular-nums">{formatCurrency(data?.value ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{data?.count ?? 0} matters</span>
                              <span>{pct.toFixed(0)}% of aged debt</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Full Aged Debtors Register</CardTitle>
                  <CardDescription>{agingRows.length} matters — export via CSV button above</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Debtor</TableHead>
                        <TableHead>Scheme</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingRows.map((row) => (
                        <TableRow key={row.matterId}>
                          <TableCell>
                            <Link href={`/matters/${row.matterId}`} className="font-mono text-xs text-primary hover:underline">
                              {row.reference}
                            </Link>
                          </TableCell>
                          <TableCell>{row.debtorName}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{row.schemeName}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px]", STAGE_COLORS[row.stage])}>{row.stage}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.totalOutstanding)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
