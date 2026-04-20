import { useState } from "react";
import { useListSchemes } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, Building2, MapPin } from "lucide-react";
import { Link } from "wouter";

export function SchemesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useListSchemes({ page, limit, search: search || undefined });

  const raw = data as any;
  const schemes = Array.isArray(raw) ? raw : raw?.schemes ?? [];
  const total = raw?.total ?? (Array.isArray(raw) ? raw.length : 0);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schemes</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} schemes registered</p>
        </div>
        <Link href="/schemes/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Scheme
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search schemes..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : schemes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No schemes found</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {schemes.map((scheme: any) => (
                <div key={scheme.id} className="p-5 border rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{scheme.name}</p>
                        <p className="text-xs text-muted-foreground">{scheme.agent?.name || "No agent"}</p>
                      </div>
                    </div>
                    <Badge variant={scheme.isActive ? "default" : "secondary"}>
                      {scheme.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {scheme.address && (
                    <div className="flex items-start gap-1.5 text-sm text-muted-foreground mb-3">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{scheme.address}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Levy</p>
                      <p className="font-semibold text-sm">{formatCurrency(scheme.levyAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Active Matters</p>
                      <p className="font-semibold text-sm">{scheme.matterCount ?? 0}</p>
                    </div>
                  </div>
                </div>
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
