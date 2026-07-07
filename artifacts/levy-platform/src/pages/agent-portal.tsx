import { useListSchemes, useListMatters } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export function AgentPortalPage() {
  const { data: schemesData, isLoading: schemesLoading } = useListSchemes();
  const { data: mattersData, isLoading: mattersLoading } = useListMatters();

  const schemes = Array.isArray(schemesData) ? schemesData : (schemesData as any)?.schemes ?? [];
  const matters = Array.isArray(mattersData) ? mattersData : (mattersData as any)?.matters ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Read-only view for agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <h2 className="font-semibold mb-3">Clients</h2>
            {schemesLoading ? <div>Loading…</div> : (
              schemes.length === 0 ? <div className="text-sm text-muted-foreground">No clients</div> : (
                <div className="space-y-2">
                  {schemes.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.agentName}</div>
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(s.levyAmount)}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-semibold mb-3">Matters</h2>
            {mattersLoading ? <div>Loading…</div> : (
              matters.length === 0 ? <div className="text-sm text-muted-foreground">No matters</div> : (
                <div className="space-y-2">
                  {matters.slice(0, 20).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{m.reference}</div>
                        <div className="text-xs text-muted-foreground">{m.debtorName}</div>
                      </div>
                      <div className="text-sm font-semibold">{m.status}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AgentPortalPage;
