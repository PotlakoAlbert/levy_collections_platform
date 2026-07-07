import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CommunicationsLog({ matterId, debtorId }: { matterId: string; debtorId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState("EMAIL");
  const [body, setBody] = useState("");

  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await customFetch<any[]>(`/api/communications?matterId=${matterId}`, { method: "GET" });
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(sorted);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 5000);
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.matterId || detail.matterId === matterId) load();
    };
    window.addEventListener("communications-refresh", onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("communications-refresh", onRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  const handleSubmit = async () => {
    if (!to || !body) {
      toast({ title: "Validation", description: "Please provide recipient and body", variant: "destructive" });
      return;
    }

    try {
      const json = await customFetch<any>(`/api/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId, to, channel, body }),
      });
      setItems((s) => [json, ...s]);
      setTo("");
      setBody("");
      toast({ title: "Logged", description: "Communication recorded" });
    } catch {
      toast({ title: "Error", description: "Failed to log communication", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Letters & Conversations</CardTitle>
      </CardHeader>
      <CardContent className="text-xs sm:text-sm">
        <div className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Channel</label>
              <select className="w-full rounded-md border px-3 py-2 mt-1" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="LETTER">Letter</option>
                <option value="CONVERSATION">Conversation</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">To</label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient (email or phone)" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Body</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSubmit}>Log Communication</Button>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Recent</h4>
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No communications logged</div>
            ) : (
              <div className="divide-y">
                {items.map((c) => (
                  <div key={c.id} className={cn("py-3", c.channel === "SYSTEM" && "bg-indigo-50/50 -mx-2 px-2 rounded")}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {c.channel === "SYSTEM" ? "System Activity" : `${c.channel} · ${c.to}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.createdByName ?? c.createdById} · {formatDate(c.createdAt)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{c.status}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{c.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CommunicationsLog;
