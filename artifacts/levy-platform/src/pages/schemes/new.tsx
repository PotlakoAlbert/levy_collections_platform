import { useState } from "react";
import { useLocation } from "wouter";
import { useListAgents, useCreateScheme } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function CreateSchemePage() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [levyAmount, setLevyAmount] = useState("");

  const { data: agents } = useListAgents();
  const createScheme = useCreateScheme();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createScheme.mutate({ data: { name, agentId: agentId || "", address, levyAmount: levyAmount ? parseFloat(levyAmount) : null } }, {
      onSuccess: () => setLocation("/schemes"),
      onError: () => alert("Failed to create scheme"),
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Create Client</CardTitle>
            <CardDescription>Register a client (body corporate / scheme)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Managing agent</label>
                <Select value={agentId} onValueChange={(v) => setAgentId(v || undefined)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>
                    {(agents || []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly levy amount</label>
                <Input value={levyAmount} onChange={(e) => setLevyAmount(e.target.value)} type="number" step="0.01" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createScheme.isPending}>Create Client</Button>
                <Button variant="ghost" onClick={() => setLocation("/schemes")}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CreateSchemePage;
