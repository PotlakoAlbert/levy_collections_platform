import React from "react";
import { Link } from "wouter";
import { useGetDebtor, useGetDebtorMatters, useGenerateDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export function DebtorDetailPage({ id }: { id: string }) {
  const { data, isLoading } = useGetDebtor(id);
  const { data: matters } = useGetDebtorMatters(id);
  const generateDoc = useGenerateDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!data) return <div className="text-center py-12 text-muted-foreground">Debtor not found</div>;

  const d: any = data;

  async function handleDelete() {
    if (!confirm("Delete this debtor? This cannot be undone.")) return;
    try {
      await customFetch(`/api/debtors/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      toast({ title: "Deleted", description: "Debtor deleted" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete debtor", variant: "destructive" });
    }
  }

  async function handleGenerateAndSend(matterId: string) {
    try {
      const doc = await generateDoc.mutateAsync({ data: { matterId, docType: "LOD" } });
      // send to debtor via available channels
      const channels = [];
      if (d.email) channels.push("EMAIL");
      if (d.whatsapp || d.phone) channels.push("WHATSAPP");
      if (channels.length === 0) {
        toast({ title: "No recipient", description: "Debtor has no email or whatsapp/phone" });
        return;
      }
      await customFetch(`/api/documents/${doc.id}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channels }) });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Sent", description: `Document sent via ${channels.join(",")}` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate or send document", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{d.fullName}</h1>
          <p className="text-sm text-muted-foreground">ID: {d.idNumber || "-"} · Company: {d.companyName ?? "-"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/debtors"><Button variant="ghost">Back</Button></Link>
          <Button variant="outline" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Email: {d.email ?? "-"}</p>
            <p className="text-sm">Phone: {d.phone ?? "-"}</p>
            <p className="text-sm">WhatsApp: {d.whatsapp ?? "-"}</p>
            <Separator className="my-2" />
            <p className="text-sm">Address: {d.physicalAddress ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Status: {d.status}</p>
            <p className="text-sm">Created: {formatDate(d.createdAt)}</p>
            <p className="text-sm">Matters: {d.matterCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-2">Generate and send standard LOD for a matter:</p>
            {(matters || []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">{m.reference}</p>
                  <p className="text-xs text-muted-foreground">Outstanding: {formatCurrency((m.capitalArrears||0) + (m.interest||0) + (m.legalCosts||0) - (m.totalPaid||0))}</p>
                </div>
                <Button size="sm" onClick={() => handleGenerateAndSend(m.id)}>Send LOD</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DebtorDetailPage;
