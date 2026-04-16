import { useGetMatter, useUpdateMatterStage } from "@workspace/api-client-react";
import { formatCurrency, formatDate, STAGE_COLORS, PRIORITY_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Phone, Mail, MapPin, CheckCircle2, Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const STAGE_ORDER = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("p-4 rounded-lg border", highlight ? "border-primary/20 bg-primary/5" : "bg-muted/30")}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", highlight ? "text-primary" : "")}>{value}</p>
    </div>
  );
}

export function MatterDetailPage({ id }: { id: string }) {
  const { data, isLoading } = useGetMatter(id);
  const advanceStage = useUpdateMatterStage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }
  if (!data) {
    return <div className="text-center py-20 text-muted-foreground">Matter not found</div>;
  }

  const m = data as any;
  const payments = m.payments ?? [];
  const tasks = m.tasks ?? [];
  const history = m.history ?? [];

  const currentStageIdx = STAGE_ORDER.indexOf(m.stage);
  const nextStage = currentStageIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentStageIdx + 1] : null;

  const totalOutstanding = (m.capitalArrears || 0) + (m.interest || 0) + (m.legalCosts || 0) - (m.totalPaid || 0);

  function handleAdvance() {
    if (!nextStage) return;
    advanceStage.mutate(
      { id, data: { stage: nextStage as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["matter", id] });
          queryClient.invalidateQueries({ queryKey: ["matters"] });
          toast({ title: "Stage advanced", description: `Matter moved to ${nextStage}` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to advance stage", variant: "destructive" });
        }
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/matters">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Matters
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono tracking-tight">{m.reference}</h1>
            <Badge className={cn("text-sm font-semibold", STAGE_COLORS[m.stage])}>
              {m.stage}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", PRIORITY_COLORS[m.priority])}>
              {m.priority}
            </Badge>
            <span className="text-sm text-muted-foreground">Assigned: {m.assignedToName || "Unassigned"}</span>
          </div>
        </div>
        {nextStage && m.stage !== "CLOSED" && (
          <Button onClick={handleAdvance} disabled={advanceStage.isPending}>
            Advance to {nextStage}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Capital Arrears" value={formatCurrency(m.capitalArrears)} />
        <StatCard label="Interest Accrued" value={formatCurrency(m.interest)} />
        <StatCard label="Legal Costs" value={formatCurrency(m.legalCosts)} />
        <StatCard label="Total Outstanding" value={formatCurrency(totalOutstanding)} highlight />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Debtor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.debtor ? (
              <>
                <p className="font-semibold text-base">{m.debtor.firstName} {m.debtor.lastName}</p>
                <p className="text-xs text-muted-foreground font-mono">{m.debtor.idNumber}</p>
                <Separator />
                {m.debtor.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{m.debtor.email}</span>
                  </div>
                )}
                {m.debtor.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{m.debtor.phone}</span>
                  </div>
                )}
                {m.debtor.physicalAddress && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-muted-foreground text-xs">{m.debtor.physicalAddress}</span>
                  </div>
                )}
              </>
            ) : <p className="text-muted-foreground text-sm">No debtor linked</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Scheme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.scheme ? (
              <>
                <p className="font-semibold text-base">{m.scheme.name}</p>
                <p className="text-sm text-muted-foreground">Unit: <span className="font-medium text-foreground">{m.unit}</span></p>
                <p className="text-sm text-muted-foreground">Monthly Levy: <span className="font-medium text-foreground">{formatCurrency(m.scheme.levyAmount)}</span></p>
                {m.scheme.agentName && (
                  <p className="text-sm text-muted-foreground">Agent: <span className="font-medium text-foreground">{m.scheme.agentName}</span></p>
                )}
                {m.scheme.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-muted-foreground text-xs">{m.scheme.address}</span>
                  </div>
                )}
              </>
            ) : <p className="text-muted-foreground text-sm">No scheme linked</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Interest From", date: m.interestFromDate },
              { label: "LOD Sent", date: m.lodDate },
              { label: "S129 Notice", date: m.s129Date },
              { label: "Summons Issued", date: m.summonsDate },
              { label: "Judgment", date: m.judgmentDate },
              { label: "Writ Issued", date: m.writDate },
            ].filter(x => x.date || ["Interest From", "LOD Sent"].includes(x.label)).map(({ label, date }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-medium", !date && "text-muted-foreground")}>{formatDate(date)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Payments Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded</p>
            ) : (
              <>
                <div className="divide-y">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center py-3">
                      <div>
                        <p className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.receivedDate)} · {p.method}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{p.allocatedTo}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm font-semibold">
                  <span>Total Paid</span>
                  <span className="text-green-600">{formatCurrency(m.totalPaid)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks</p>
            ) : (
              <div className="divide-y">
                {tasks.map((t: any) => (
                  <div key={t.id} className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <Badge
                        variant={t.status === "COMPLETED" ? "default" : "outline"}
                        className={cn("text-xs", t.status === "COMPLETED" ? "bg-green-500 text-white" : "")}
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {t.dueDate && <span>Due: {format(new Date(t.dueDate), "dd MMM yyyy")}</span>}
                      {t.assigneeName && <span>{t.assigneeName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" /> Stage History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    {h.fromStage && (
                      <>
                        <Badge className={cn("text-xs", STAGE_COLORS[h.fromStage])}>{h.fromStage}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge className={cn("text-xs", STAGE_COLORS[h.toStage])}>{h.toStage}</Badge>
                  </div>
                  <span className="text-muted-foreground text-xs">{h.changedByName}</span>
                  {h.notes && <span className="text-muted-foreground text-xs">— {h.notes}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{format(new Date(h.createdAt), "dd MMM yyyy")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
