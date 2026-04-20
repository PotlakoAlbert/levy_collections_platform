import React, { useState } from "react";
import { useListDebtors } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  DEFAULTING: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  ABSCONDED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  DECEASED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export function DebtorsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useListDebtors({ page, limit, search: search || undefined });

  const raw = data as any;
  const debtors = Array.isArray(raw) ? raw : raw?.debtors ?? [];
  const total = raw?.total ?? (Array.isArray(raw) ? raw.length : 0);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debtors</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} registered debtors</p>
        </div>
        <Link href="/debtors/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Debtor
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID number..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : debtors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No debtors found</div>
          ) : (
            <div className="grid gap-3">
                {debtors.map((debtor: any) => (
                  <DebtorRow key={debtor.id} debtor={debtor} />
                ))}
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

function DebtorRow({ debtor }: { debtor: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const initials = `${debtor.firstName?.[0] ?? ""}${debtor.lastName?.[0] ?? ""}`;

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
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/40 transition-colors">
      <Link href={`/debtors/${debtor.id}`} className="flex items-center gap-4 flex-1 no-underline">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
          {initials}
        </div>
        <div>
          <p className="font-semibold">{debtor.firstName} {debtor.lastName}</p>
          <p className="text-xs text-muted-foreground font-mono">{debtor.idNumber}</p>
        </div>
      </Link>

      <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
        {debtor.email && (
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />{debtor.email}
          </span>
        )}
        {debtor.phone && (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />{debtor.phone}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge className={cn("text-xs", STATUS_COLORS[debtor.status] || STATUS_COLORS.ACTIVE)}>{debtor.status}</Badge>
        <Button variant="ghost" size="sm" onClick={handleDelete}>Delete</Button>
      </div>
    </div>
  );
}
