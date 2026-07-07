import React, { useState } from "react";
import { useListDebtors } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, Phone, Mail, AlertCircle, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { cn, formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  DEFAULTING: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  ABSCONDED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  DECEASED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export function DebtorsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useListDebtors({ search: search || undefined });

  const raw = data as any;
  let debtors = Array.isArray(raw) ? raw : raw?.debtors ?? [];
  const total = raw?.total ?? (Array.isArray(raw) ? raw.length : 0);
  
  // Apply status filter
  if (statusFilter !== "all") {
    debtors = debtors.filter((d: any) => d.status === statusFilter);
  }
  
  const totalPages = Math.ceil(debtors.length / limit);
  const paginatedDebtors = debtors.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Debtors Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">360-degree debtor profiles with financial snapshots and collection status.</p>
        </div>
        <Link href="/debtors/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Debtor
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Debtors</p>
                <p className="text-2xl font-bold mt-1">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{debtors.filter((d: any) => d.status === "ACTIVE").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Defaulting</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{debtors.filter((d: any) => d.status === "DEFAULTING").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Matters Count</p>
                <p className="text-2xl font-bold mt-1">{debtors.reduce((sum: number, d: any) => sum + (d.matterCount || 0), 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ID number, email..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DEFAULTING">Defaulting</SelectItem>
                  <SelectItem value="ABSCONDED">Absconded</SelectItem>
                  <SelectItem value="DECEASED">Deceased</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : debtors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No debtors found</div>
            ) : (
              <div className="grid gap-3">
                {paginatedDebtors.map((debtor: any) => (
                  <DebtorRow key={debtor.id} debtor={debtor} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({debtors.length} total)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DebtorRow({ debtor }: { debtor: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const initials = `${debtor.firstName?.[0] ?? ""}${debtor.lastName?.[0] ?? ""}`;
  const totalOutstanding = debtor.totalOutstanding || 0;
  const totalMatters = debtor.matterCount || 0;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this debtor? This cannot be undone.")) return;
    try {
      await customFetch(`/api/debtors/${debtor.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      toast({ title: "Deleted", description: "Debtor deleted" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete debtor", variant: "destructive" });
    }
  }

  return (
    <Link href={`/debtors/${debtor.id}`} className="no-underline">
      <div className="p-4 border rounded-lg hover:shadow-md transition-all hover:border-primary/50 cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
              {initials}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-base">{debtor.firstName} {debtor.lastName}</p>
                <Badge className={cn("text-xs", STATUS_COLORS[debtor.status] || STATUS_COLORS.ACTIVE)}>
                  {debtor.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">{debtor.idNumber || "-"}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                {debtor.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{debtor.email}</span>
                  </span>
                )}
                {debtor.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {debtor.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-medium">{totalMatters} matter{totalMatters !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.preventDefault()}>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
