import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListDebtors, useListSchemes, useListUsers, useCreateMatter } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function CreateMatterPage() {
  const [, setLocation] = useLocation();
  const { data: debtorsRaw } = useListDebtors({ page: 1, limit: 200 });
  const { data: schemesRaw } = useListSchemes({ page: 1, limit: 200 });
  const { data: usersRaw } = useListUsers();

  const [debtorId, setDebtorId] = useState<string | undefined>(undefined);
  const [schemeId, setSchemeId] = useState<string | undefined>(undefined);
  const [unit, setUnit] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [capitalArrears, setCapitalArrears] = useState("");
  const [legalCosts, setLegalCosts] = useState("");
  const [assignedToId, setAssignedToId] = useState<string | undefined>(undefined);

  const createMatter = useCreateMatter();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pre = params.get("debtorId");
      if (pre) setDebtorId(pre);
    } catch (e) {
      // ignore
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debtorId || !schemeId) {
      return alert("Please select debtor and scheme");
    }

    createMatter.mutate({ data: {
      debtorId,
      schemeId,
      unit: unit || null,
      priority: priority as any,
      capitalArrears: capitalArrears ? parseFloat(capitalArrears) : 0,
      legalCosts: legalCosts ? parseFloat(legalCosts) : 0,
      assignedToId: assignedToId ?? null,
    } }, {
      onSuccess: (m: any) => setLocation(`/matters/${m.id}`),
      onError: () => alert("Failed to create matter"),
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Matter</CardTitle>
            <CardDescription>Create a new matter and auto-generate reference</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Debtor</label>
                <Select value={debtorId} onValueChange={(v) => setDebtorId(v || undefined)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select debtor" /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(debtorsRaw) ? debtorsRaw : (debtorsRaw as any)?.debtors ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheme</label>
                <Select value={schemeId} onValueChange={(v) => setSchemeId(v || undefined)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select scheme" /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(schemesRaw) ? schemesRaw : (schemesRaw as any)?.schemes ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</label>
                  <Select value={priority} onValueChange={(v) => setPriority(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capital Arrears</label>
                  <Input value={capitalArrears} onChange={(e) => setCapitalArrears(e.target.value)} type="number" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal Costs</label>
                  <Input value={legalCosts} onChange={(e) => setLegalCosts(e.target.value)} type="number" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assign to</label>
                <Select value={assignedToId} onValueChange={(v) => setAssignedToId(v || undefined)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(usersRaw) ? usersRaw : (usersRaw as any)?.users ?? []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMatter.isPending}>Create Matter</Button>
                <Button variant="ghost" onClick={() => setLocation("/matters")}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CreateMatterPage;
