import { useState } from "react";
import { useListMatters } from "@workspace/api-client-react";
import { formatCurrency, formatDate, STAGE_COLORS, PRIORITY_COLORS } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Search, PlusCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["ALL", "LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];

export function MattersPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useListMatters({
    page,
    limit,
    search: search || undefined,
    stage: stageFilter !== "ALL" ? stageFilter as any : undefined,
  });

  const matters = (data as any)?.matters ?? [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matters</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total matters</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Matter
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference, debtor name..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s} value={s}>{s === "ALL" ? "All Stages" : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : matters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No matters found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="pb-3 pr-4 text-left">Reference</th>
                    <th className="pb-3 pr-4 text-left">Debtor</th>
                    <th className="pb-3 pr-4 text-left">Scheme / Unit</th>
                    <th className="pb-3 pr-4 text-left">Stage</th>
                    <th className="pb-3 pr-4 text-left">Priority</th>
                    <th className="pb-3 pr-4 text-right">Outstanding</th>
                    <th className="pb-3 text-left">LOD Date</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matters.map((matter: any) => (
                    <tr key={matter.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 pr-4 font-mono font-semibold text-primary">{matter.reference}</td>
                      <td className="py-3 pr-4 font-medium">
                        {matter.debtorName || "-"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        <div>{matter.schemeName ?? "-"}</div>
                        <div className="text-xs">{matter.unit}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={cn("text-xs font-semibold", STAGE_COLORS[matter.stage])}>
                          {matter.stage}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className={cn("text-xs", PRIORITY_COLORS[matter.priority])}>
                          {matter.priority}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                        {formatCurrency((matter.capitalArrears || 0) + (matter.interest || 0) + (matter.legalCosts || 0) - (matter.totalPaid || 0))}
                      </td>
                      <td className="py-3 text-muted-foreground">{formatDate(matter.lodDate)}</td>
                      <td className="py-3 pl-4">
                        <Link href={`/matters/${matter.id}`}>
                          <Button variant="ghost" size="sm">
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
