import React from "react";
import { Link } from "wouter";
import { useGetDebtor, useGetDebtorMatters, useGenerateDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import type { Debtor } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import { io as socketIOClient } from "socket.io-client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toastAutomationEvent } from "@/lib/automation-toasts";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, Phone, MapPin, FileText, MessageSquare, Phone as PhoneIcon, 
  DollarSign, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle2,
  Edit, Share2, Download, MessageCircle, Calendar
} from "lucide-react";

type ActivityItem = {
  id: string;
  eventType?: string;
  message: string;
  status?: string;
  createdAt: string;
  matterId?: string | null;
};

export function DebtorDetailPage({ id }: { id: string }) {
  const [waitingForReply, setWaitingForReply] = React.useState(false);
  const waitingTimerRef = React.useRef<number | null>(null);
  const [filter, setFilter] = React.useState<"all" | "wa" | "doc" | "comm" | "activity">("all");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [latestInbound, setLatestInbound] = React.useState<{ content: string; createdAt?: string } | null>(null);
  const [liveActivity, setLiveActivity] = React.useState<ActivityItem[]>([]);
  const [liveStatus, setLiveStatus] = React.useState<string | null>(null);
  const [activeJob, setActiveJob] = React.useState<{ label: string; queueName: string; jobId: string } | null>(null);
  const socketRef = React.useRef<ReturnType<typeof socketIOClient> | null>(null);
  const [highlightedKey, setHighlightedKey] = React.useState<string | null>(null);
  const highlightTimeoutRef = React.useRef<number | null>(null);

  const { data, isLoading } = useGetDebtor(id, { query: { refetchInterval: waitingForReply ? 3000 : false } } as any);
  const { data: matters } = useGetDebtorMatters(id);
  const generateDoc = useGenerateDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const debtorQueryKey = [`/api/debtors/${id}`];

  function attemptScrollToKey(key: string) {
    const escaped = key.replace(/"/g, '\\"').replace(/\\/g, "\\\\");
    let attempts = 0;
    const maxAttempts = 20;
    const iv = window.setInterval(() => {
      attempts += 1;
      const el = document.querySelector(`[data-key="${escaped}"]`) as HTMLElement | null;
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          /* ignore */
        }
        window.clearInterval(iv);
        return;
      }
      if (attempts >= maxAttempts) window.clearInterval(iv);
    }, 150);
  }

  React.useEffect(() => {
    if (!highlightedKey) return;
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedKey(null);
      highlightTimeoutRef.current = null;
    }, 3000);
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [highlightedKey]);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = socketIOClient(undefined, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinDebtor", id);
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: debtorQueryKey });

    socket.on("debtor_activity", (payload: any) => {
      const message = payload?.message ?? payload?.communication?.body ?? "Automation update";
      const createdAt = payload?.communication?.createdAt ?? new Date().toISOString();
      const activityId = payload?.eventLog?.id ?? payload?.communication?.id ?? `live-${Date.now()}`;
      setLiveActivity((prev) => [{ id: activityId, message, status: payload?.status, eventType: payload?.eventType, createdAt, matterId: payload?.eventLog?.matterId }, ...prev].slice(0, 50));
      toastAutomationEvent(toast, {
        eventType: payload?.eventType,
        message,
        status: payload?.status,
      });
      refresh();
    });

    socket.on("bot_typing", (payload: any) => {
      if (payload?.matterId && payload.matterId !== id) return;
      setLiveStatus(payload?.message ?? "Bot is preparing a reply...");
      toast({ title: "Bot typing", description: payload?.message ?? "Automated reply is being generated" });
      refresh();
    });

    socket.on("job_queued", (payload: any) => {
      if (payload?.matterId && payload.matterId !== id) return;
      const label = payload?.label ?? "Job";
      setLiveStatus(`${label} queued in ${payload?.queueName ?? "queue"}`);
      toast({ title: "Job queued", description: `${label} queued` });
      refresh();
    });

    socket.on("job_started", (payload: any) => {
      if (payload?.matterId && payload.matterId !== id) return;
      const label = payload?.label ?? "Job";
      setLiveStatus(`${label} started in ${payload?.queueName ?? "queue"}`);
      setActiveJob({ label, queueName: payload?.queueName ?? "unknown", jobId: payload?.jobId ?? "" });
      toast({ title: "Job started", description: `${label} has started` });
      refresh();
    });

    socket.on("whatsapp_inbound", (payload: any) => {
      const content = payload?.whatsappMessage?.content ?? payload?.communication?.body ?? "New message";
      const createdAt = payload?.whatsappMessage?.createdAt ?? payload?.communication?.createdAt ?? new Date().toISOString();
      const waId = payload?.whatsappMessage?.id ?? null;
      const commId = payload?.communication?.id ?? null;
      setLatestInbound({ content, createdAt });
      const key = waId ? `wa:${waId}` : commId ? `comm:${commId}` : `time:${createdAt}`;
      setHighlightedKey(key);
      attemptScrollToKey(key);
      toast({ title: "Reply received", description: content });
      setWaitingForReply(false);
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      refresh();
    });

    socket.on("whatsapp_outbound", () => refresh());
    socket.on("document_sent", () => refresh());
    socket.on("document_generated", (payload: any) => {
      const docType = payload?.documentType ?? "Document";
      toast({ title: "Document ready", description: `${docType} generated` });
      refresh();
    });
    socket.on("communication_sent", () => refresh());

    return () => {
      try {
        socket.emit("leaveDebtor", id);
        socket.disconnect();
      } catch {
        /* ignore */
      }
      socketRef.current = null;
    };
  }, [id, queryClient, toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!data) {
    return <div className="text-center py-12 text-muted-foreground">Debtor not found</div>;
  }

  const d = data as Debtor & {
    activityLog?: ActivityItem[];
    communications?: any[];
    whatsappMessages?: any[];
    documents?: any[];
  };

  async function handleDelete() {
    if (!confirm("Delete this debtor? This cannot be undone.")) return;
    try {
      await customFetch(`/api/debtors/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      toast({ title: "Deleted", description: "Debtor deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete debtor", variant: "destructive" });
    }
  }

  async function handleGenerateAndSend(matterId: string) {
    try {
      const doc = await generateDoc.mutateAsync({ data: { matterId, docType: "LOD" } });
      const channels = [];
      if (d.email) channels.push("EMAIL");
      if (d.whatsapp || d.phone) channels.push("WHATSAPP");
      if (channels.length === 0) {
        toast({ title: "No recipient", description: "Debtor has no email or whatsapp/phone" });
        return;
      }
      await customFetch(`/api/documents/${doc.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: debtorQueryKey });
      setWaitingForReply(true);
      toast({ title: "Sent", description: `Document sent via ${channels.join(",")}. Waiting for reply...` });
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = window.setTimeout(() => {
        setWaitingForReply(false);
        toast({ title: "No reply", description: "No inbound reply received within 2 minutes" });
        waitingTimerRef.current = null;
      }, 2 * 60 * 1000);
    } catch {
      toast({ title: "Error", description: "Failed to generate or send document", variant: "destructive" });
    }
  }

  const persistedActivity = d.activityLog ?? [];
  const allActivity = [...liveActivity, ...persistedActivity.filter((p) => !liveActivity.some((l) => l.id === p.id))];

  function statusBadge(status?: string) {
    if (!status) return null;
    const colors: Record<string, string> = {
      IN_PROGRESS: "bg-amber-100 text-amber-800",
      COMPLETED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
      SCHEDULED: "bg-blue-100 text-blue-800",
      ESCALATED: "bg-purple-100 text-purple-800",
    };
    return <span className={cn("px-2 py-0.5 rounded text-xs", colors[status] ?? "bg-gray-100 text-gray-800")}>{status}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Profile */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {d.firstName?.[0]}{d.lastName?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{d.fullName}</h1>
              <Badge className={cn(
                "text-xs",
                d.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                d.status === "DEFAULTING" ? "bg-red-100 text-red-800" :
                d.status === "ABSCONDED" ? "bg-gray-100 text-gray-800" :
                "bg-purple-100 text-purple-800"
              )}>
                {d.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">ID: {d.idNumber} · Company: {d.companyName ?? "-"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/debtors"><Button variant="ghost">Back</Button></Link>
          <Button variant="outline" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      {/* Financial Snapshot - Big Three Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency((matters || []).reduce((sum: number, m: any) => sum + ((m.capitalArrears || 0) + (m.interest || 0) + (m.legalCosts || 0) - (m.totalPaid || 0)), 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Across {(matters || []).length} matter{(matters || []).length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Principal + Interest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency((matters || []).reduce((sum: number, m: any) => sum + ((m.capitalArrears || 0) + (m.interest || 0)), 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Principal debt & accrued interest</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency((matters || []).reduce((sum: number, m: any) => sum + (m.totalPaid || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Life-to-date payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact & Profile Information */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{d.email}</p>
                </div>
              </div>
            )}
            {d.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{d.phone}</p>
                </div>
              </div>
            )}
            {d.whatsapp && (
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="text-sm font-medium">{d.whatsapp}</p>
                </div>
              </div>
            )}
            {d.physicalAddress && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm">{d.physicalAddress}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Debtor Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium">{d.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Member Since</p>
              <p className="text-sm font-medium">{formatDate(d.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Linked Matters</p>
              <p className="text-sm font-medium">{d.matterCount ?? 0} active</p>
            </div>
            {d.companyName && (
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium">{d.companyName}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Hub */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            <Button variant="outline" className="justify-start gap-2" disabled={!(d.email || d.whatsapp || d.phone)}>
              <MessageSquare className="h-4 w-4" />
              Send Message
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <Calendar className="h-4 w-4" />
              Promise to Pay
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <DollarSign className="h-4 w-4" />
              Settle Debt
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <AlertTriangle className="h-4 w-4" />
              Dispute Debt
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Linked Matters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Matters</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">All collection cases for this debtor</p>
        </CardHeader>
        <CardContent>
          {(!matters || matters.length === 0) ? (
            <p className="text-sm text-muted-foreground">No linked matters</p>
          ) : (
            <div className="space-y-3">
              {(matters || []).map((m: any) => {
                const outstanding = (m.capitalArrears || 0) + (m.interest || 0) + (m.legalCosts || 0) - (m.totalPaid || 0);
                const progress = m.capitalArrears > 0 ? ((m.totalPaid / m.capitalArrears) * 100).toFixed(0) : 0;
                return (
                  <Link key={m.id} href={`/matters/${m.id}`} className="no-underline">
                    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold text-sm">{m.reference}</p>
                          <p className="text-xs text-muted-foreground">{m.description || "Collection matter"}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{m.stage}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all" 
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{progress}% recovered</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{formatCurrency(outstanding)}</p>
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Principal: {formatCurrency(m.capitalArrears || 0)}</span>
                        <span>Interest: {formatCurrency(m.interest || 0)}</span>
                        <span>Paid: {formatCurrency(m.totalPaid || 0)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Automation Status */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-base">Live Automation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">{liveStatus ?? "No active automation events"}</p>
            {activeJob && (
              <p className="text-xs text-muted-foreground mt-2">
                <Clock className="h-3 w-3 inline mr-1" />
                Active job: {activeJob.label} in {activeJob.queueName}
              </p>
            )}
          </div>
          {waitingForReply && (
            <div className="mt-3 p-3 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950 rounded">
              <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <div className="animate-spin h-3 w-3 border-2 border-amber-500 border-t-transparent rounded-full" />
                Waiting for debtor reply (listening for WhatsApp)...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation & Documents - Enhanced */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="text-base">Communication History & Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Chronological record of all interactions with this debtor</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant={filter === "all" ? "default" : "ghost"} onClick={() => setFilter("all")}>All</Button>
              <Button size="sm" variant={filter === "wa" ? "default" : "ghost"} onClick={() => setFilter("wa")}>WhatsApp</Button>
              <Button size="sm" variant={filter === "doc" ? "default" : "ghost"} onClick={() => setFilter("doc")}>Docs</Button>
              <Button size="sm" variant={filter === "comm" ? "default" : "ghost"} onClick={() => setFilter("comm")}>Comms</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {latestInbound && (
            <div className="mb-4 p-3 border-l-4 border-l-primary bg-primary/5 rounded">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Latest inbound: <span className="text-primary">{latestInbound.content}</span></p>
                <p className="text-xs text-muted-foreground">{latestInbound.createdAt ? formatDate(latestInbound.createdAt) : ""}</p>
              </div>
            </div>
          )}
          {(() => {
            const wa = d.whatsappMessages || [];
            const docs = d.documents || [];
            const comms = d.communications || [];

            let items = [
              ...wa.map((m: any) => ({ type: "wa", date: new Date(m.createdAt), raw: m })),
              ...docs.map((m: any) => ({ type: "doc", date: new Date(m.createdAt), raw: m })),
              ...comms.map((m: any) => ({ type: m.channel === "SYSTEM" ? "activity" : "comm", date: new Date(m.createdAt), raw: m })),
              ...allActivity.map((a) => ({ type: "activity", date: new Date(a.createdAt), raw: a })),
            ];

            if (filter !== "all") {
              items = items.filter((it: any) => it.type === filter);
            }

            items.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

            if (items.length === 0) {
              return <div className="text-sm text-muted-foreground text-center py-8">No communication history</div>;
            }

            const threads: Record<string, { key: string; title: string; items: any[] }> = {};
            items.forEach((it: any) => {
              const mid = it.raw?.matterId ?? null;
              const key = mid || "_general";
              if (!threads[key]) {
                const found = (matters || []).find((m: any) => m.id === mid);
                const title = found ? found.reference : key === "_general" ? "General" : key;
                threads[key] = { key, title, items: [] };
              }
              threads[key].items.push(it);
            });

            const threadKeys = Object.keys(threads).sort((a: any, b: any) => {
              const ta = threads[a].items[0]?.date?.getTime() || 0;
              const tb = threads[b].items[0]?.date?.getTime() || 0;
              return tb - ta;
            });

            return (
              <div className="space-y-3">
                {threadKeys.map((k) => {
                  const t = threads[k];
                  const isCollapsed = collapsed[k] ?? false;
                  return (
                    <div key={k} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-muted hover:bg-muted/80 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="font-semibold text-sm">{t.title}</div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">{t.items.length}</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-xs text-muted-foreground">{new Date(t.items[0].date).toLocaleString()}</p>
                          <Button size="sm" onClick={() => setCollapsed((c) => ({ ...c, [k]: !isCollapsed }))}>
                            {isCollapsed ? "Show" : "Hide"}
                          </Button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                          {t.items.map((it: any, idx: number) => {
                            const itemKey = it.type === "wa"
                              ? `wa:${it.raw?.id}`
                              : it.type === "doc"
                                ? `doc:${it.raw?.id}`
                                : it.type === "activity"
                                  ? `activity:${it.raw?.id ?? idx}`
                                  : `comm:${it.raw?.id}`;
                            return (
                              <div
                                key={idx}
                                data-key={itemKey}
                                className={cn("p-3 border rounded transition-colors duration-300", highlightedKey === itemKey ? "ring-2 ring-primary bg-primary/5" : "")}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-muted-foreground">{it.date.toLocaleString()}</span>
                                  <div className="flex items-center gap-1">
                                    {it.type === "wa" && <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900">WhatsApp</Badge>}
                                    {it.type === "doc" && <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900">Document</Badge>}
                                    {it.type === "comm" && <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900">Comm</Badge>}
                                    {it.type === "activity" && <Badge className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900">System</Badge>}
                                    {it.type === "activity" && statusBadge(it.raw?.status)}
                                  </div>
                                </div>
                                {it.type === "wa" && (
                                  <div>
                                    <p className="font-semibold text-sm">{it.raw.direction === "INBOUND" ? "📱 Debtor Message" : "📤 System Message"}</p>
                                    <p className="text-sm mt-1">{it.raw.content}</p>
                                  </div>
                                )}
                                {it.type === "doc" && (
                                  <div>
                                    <p className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" />{it.raw.docType}</p>
                                    <a href={it.raw.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{it.raw.fileName}</a>
                                    {it.raw.sentVia && <p className="text-xs text-muted-foreground mt-1">Sent via {it.raw.sentVia}</p>}
                                  </div>
                                )}
                                {it.type === "comm" && (
                                  <div>
                                    <p className="font-semibold text-sm">{it.raw.channel} → {it.raw.to}</p>
                                    <p className="text-sm mt-1">{it.raw.body}</p>
                                    {it.raw.status && <p className="text-xs text-muted-foreground mt-1">Status: {it.raw.status}</p>}
                                  </div>
                                )}
                                {it.type === "activity" && (
                                  <div>
                                    <p className="font-semibold text-sm">{it.raw.eventType ?? "Automation"}</p>
                                    <p className="text-sm mt-1">{it.raw.body ?? it.raw.message}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

export default DebtorDetailPage;
