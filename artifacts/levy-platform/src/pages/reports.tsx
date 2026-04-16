import { useGetPipelineSummary, useGetCollectionsByAgent, useGetAgedDebtorsReport } from "@workspace/api-client-react";
import { formatCurrency, STAGE_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

const STAGE_CHART_COLORS: Record<string, string> = {
  LOD: "#3b82f6",
  S129: "#eab308",
  SUMMONS: "#f97316",
  JUDGMENT: "#ef4444",
  WRIT: "#a855f7",
  RULE46: "#6366f1",
  SALE: "#f43f5e",
  CLOSED: "#6b7280",
};

export function ReportsPage() {
  const { data: stageSummary, isLoading: stageLoading } = useGetPipelineSummary();
  const { data: collections, isLoading: collectionsLoading } = useGetCollectionsByAgent();
  const { data: aging, isLoading: agingLoading } = useGetAgedDebtorsReport();

  const stageData = (stageSummary as any) ?? [];
  const collectionData = (collections as any) ?? [];
  const agingData = (aging as any) ?? [];

  const maxOutstanding = Math.max(...stageData.map((s: any) => s.totalOutstanding || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Portfolio analytics and reporting</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline by Stage (Matters)</CardTitle>
          </CardHeader>
          <CardContent>
            {stageLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: number, name: string) => name === "count" ? [val, "Matters"] : [formatCurrency(val), "Outstanding"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stageData.map((entry: any, i: number) => (
                        <Cell key={i} fill={STAGE_CHART_COLORS[entry.stage] || "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outstanding by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stageLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : (
              <div className="space-y-3">
                {stageData.map((row: any) => (
                  <div key={row.stage} className="flex items-center gap-3">
                    <Badge className={cn("text-xs w-20 justify-center shrink-0", STAGE_COLORS[row.stage])}>
                      {row.stage}
                    </Badge>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, ((row.totalOutstanding || 0) / maxOutstanding) * 100)}%`,
                          backgroundColor: STAGE_CHART_COLORS[row.stage]
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold tabular-nums w-28 text-right">{formatCurrency(row.totalOutstanding)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collections by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : collectionData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No collection data yet</div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collectionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="agentName" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), "Collected"]} />
                    <Bar dataKey="totalCollected" radius={[4, 4, 0, 0]} fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Debtor Aging Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {agingLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : agingData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No aging data</div>
            ) : (
              <div className="space-y-4">
                {agingData.map((bucket: any) => (
                  <div key={bucket.bucket} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{bucket.bucket}</p>
                      <p className="text-xs text-muted-foreground">{bucket.count} matter{bucket.count !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatCurrency(bucket.totalOutstanding)}</p>
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
