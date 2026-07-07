import { useGetMatter, useUpdateMatterStage, useListUsers } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect } from "react";
import { formatCurrency, formatDate, STAGE_COLORS, PRIORITY_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Phone, Mail, MapPin, CheckCircle2, Clock, History, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PromiseToPayDialog } from "@/components/matters/PromiseToPayDialog";
import { GenerateTasksDialog } from "@/components/matters/GenerateTasksDialog";
import { WhatsAppMessaging } from "@/components/matters/WhatsAppMessaging";
import { AutomationPanel } from "@/components/matters/AutomationPanel";
import CommunicationsLog from "@/components/matters/CommunicationsLog";

const STAGE_ORDER = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("p-2 sm:p-3 md:p-4 rounded-lg border", highlight ? "border-primary/20 bg-primary/5" : "bg-muted/30")}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-lg sm:text-xl font-bold tabular-nums", highlight ? "text-primary" : "")}>{value}</p>
    </div>
  );
}

export function MatterDetailPage({ id }: { id: string }) {
  const { data, isLoading } = useGetMatter(id);
  const advanceStage = useUpdateMatterStage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: usersRaw } = useListUsers();

  // Local UI state (always declared to preserve hook order)
  const [ptpSubmitting, setPtpSubmitting] = useState(false);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string | null>(null);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<string>("COLLECTOR");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState("");
  const [installmentDay, setInstallmentDay] = useState("1");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");

  // Load assignees for this matter - must be before early returns
  useEffect(() => {
    let mounted = true;
    setAssigneesLoading(true);
    (async () => {
      try {
        const data = await customFetch<any[]>(`/api/matters/${id}/assignees`, { method: "GET" });
        if (mounted) setAssignees(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setAssignees([]);
      } finally {
        if (mounted) setAssigneesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

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
    <div className="space-y-6 px-2 sm:px-4 md:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Link href="/matters">
          <Button variant="ghost" size="sm" className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Matters
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight">{m.reference}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge className={cn("text-xs sm:text-sm font-semibold", STAGE_COLORS[m.stage])}>
                {m.stage}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", PRIORITY_COLORS[m.priority])}>
                {m.priority}
              </Badge>
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">Assigned: {m.assignedToName || "Unassigned"}</span>
          </div>
        </div>
        {nextStage && m.stage !== "CLOSED" && (
          <Button onClick={handleAdvance} disabled={advanceStage.isPending} size="sm" className="w-full sm:w-auto gap-2">
            Advance to {nextStage}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Capital Arrears" value={formatCurrency(m.capitalArrears)} />
        <StatCard label="Interest Accrued" value={formatCurrency(m.interest)} />
        <StatCard label="Legal Costs" value={formatCurrency(m.legalCosts)} />
        <StatCard label="Total Outstanding" value={formatCurrency(totalOutstanding)} highlight />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Debtor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
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
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Scheme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
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
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
            {m.client ? (
              <>
                <p className="font-semibold text-base">{m.client.name}</p>
                <p className="text-sm text-muted-foreground">ID: <span className="font-medium text-foreground">{m.client.id}</span></p>
              </>
            ) : <p className="text-muted-foreground text-sm">No client linked</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs sm:text-sm">
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Payments Received
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm">
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
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Promise To Pay
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm">
            {m.ptp ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-900 mb-2">Active Agreement</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-800">First payment:</span>
                      <span className="font-semibold">{formatCurrency(m.ptp.firstPaymentAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Due:</span>
                      <span className="font-semibold">{formatDate(m.ptp.firstPaymentDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Installments:</span>
                      <span className="font-semibold">{formatCurrency(m.ptp.installmentAmount)} on day {m.ptp.installmentDay}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/matters/${id}/ptp/deactivate`, { method: "PATCH" });
                      if (!response.ok) throw new Error("Failed");
                      queryClient.invalidateQueries({ queryKey: ["matter", id] });
                      toast({ title: "PTP deactivated" });
                    } catch (e) {
                      toast({ title: "Error", description: "Failed to deactivate PTP", variant: "destructive" });
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              </div>
            ) : (
              <PromiseToPayDialog
                matterId={id}
                debtorName={m.debtor ? `${m.debtor.firstName} ${m.debtor.lastName}` : "Debtor"}
                outstandingAmount={totalOutstanding}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assigned Users</CardTitle>
            <div>
              <AlertDialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm">Add Assignee</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Add Assignee</AlertDialogTitle>
                    <AlertDialogDescription>Select a user and role to assign to this matter.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">User</label>
                      <select className="w-full rounded-md border px-3 py-2 mt-1" value={selectedUserToAdd ?? ""} onChange={(e) => setSelectedUserToAdd(e.target.value || null)}>
                        <option value="">-- choose user --</option>
                        {(Array.isArray(usersRaw) ? usersRaw : (usersRaw as any)?.data || []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Role</label>
                      <select className="w-full rounded-md border px-3 py-2 mt-1" value={selectedRoleToAdd} onChange={(e) => setSelectedRoleToAdd(e.target.value)}>
                        <option value="COLLECTOR">Collector</option>
                        <option value="NEGOTIATOR">Negotiator</option>
                        <option value="ADVISOR">Advisor</option>
                        <option value="SUPERVISOR">Supervisor</option>
                      </select>
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      (async () => {
                        if (!selectedUserToAdd) { toast({ title: "Select user", variant: "destructive" }); return; }
                        try {
                          const json = await customFetch<any>(`/api/matters/${id}/assignees`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: selectedUserToAdd, role: selectedRoleToAdd }),
                          });
                          setAssignees((s) => [json, ...s]);
                          toast({ title: "Assigned", description: "User assigned to matter" });
                          setAddDialogOpen(false);
                          setSelectedUserToAdd(null);
                        } catch (e) {
                          toast({ title: "Error", description: "Failed to assign user", variant: "destructive" });
                        }
                      })();
                    }}>Add</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm">
            {assigneesLoading ? (
              <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : assignees.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No assignees</p>
            ) : (
              <div className="divide-y">
                {assignees.map((a: any) => (
                  <div key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{a.userName ?? a.userEmail ?? a.userId}</p>
                      <p className="text-xs text-muted-foreground">{a.role} · Assigned {formatDate(a.assignedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="destructive" onClick={async () => {
                        try {
                          await customFetch<void>(`/api/matters/${id}/assignees/${a.id}`, { method: "DELETE" });
                          setAssignees((s) => s.filter((x) => x.id !== a.id));
                          toast({ title: "Unassigned", description: "User removed from matter" });
                        } catch (e) {
                          toast({ title: "Error", description: "Failed to unassign", variant: "destructive" });
                        }
                      }}>Unassign</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Tasks
              </CardTitle>
              <GenerateTasksDialog 
                matterId={id}
                stage={m.stage}
              />
            </div>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm">
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

        {m.debtor?.id && (
          <AutomationPanel
            matterId={id}
            debtorId={m.debtor.id}
            matterReference={m.reference}
            debtorName={`${m.debtor.firstName} ${m.debtor.lastName}`}
            debtorPhone={m.debtor?.whatsapp || m.debtor?.phone}
          />
        )}
        <WhatsAppMessaging
          matterId={id}
          debtorId={m.debtor?.id}
          debtorName={m.debtor ? `${m.debtor.firstName} ${m.debtor.lastName}` : "Debtor"}
          debtorPhone={m.debtor?.whatsapp || m.debtor?.phone}
          messages={m.whatsappMessages || []}
        />
        <CommunicationsLog matterId={id} debtorId={m.debtor?.id} />
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Stage History
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm">
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
