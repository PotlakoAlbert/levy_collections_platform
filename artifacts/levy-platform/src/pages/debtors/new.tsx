import React, { useState } from "react";
import { useLocation } from "wouter";
import { useCreateDebtor } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function CreateDebtorPage() {
  const [, setLocation] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const createDebtor = useCreateDebtor();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent, opts?: { redirectToMatter?: boolean }) {
    e.preventDefault();
    createDebtor.mutate({ data: { firstName, lastName, idNumber, email, phone, companyName, whatsapp, physicalAddress, status } } as any, {
      onSuccess: (d: any) => {
        toast({ title: "Debtor created", description: `${d.firstName} ${d.lastName}` });
        if (opts?.redirectToMatter) {
          setLocation(`/matters/new?debtorId=${d.id}`);
        } else {
          setLocation("/debtors");
        }
      },
      onError: () => toast({ title: "Error", description: "Failed to create debtor", variant: "destructive" }),
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Create Debtor</CardTitle>
            <CardDescription>Enter debtor details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company (optional)</label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID / Reg No</label>
                  <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Whatsapp</label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
                  <Select value={status} onValueChange={(v) => setStatus(v)}>
                    <SelectTrigger className="w-full h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="PAYING">Paying</SelectItem>
                      <SelectItem value="DEFAULTING">Defaulting</SelectItem>
                      <SelectItem value="ABSCONDED">Absconded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Physical address</label>
                <Textarea value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} rows={3} />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createDebtor.isPending}>Create Debtor</Button>
                <Button type="button" onClick={(e) => handleSubmit(e as any, { redirectToMatter: true })} disabled={createDebtor.isPending}>Create & Add Matter</Button>
                <Button variant="ghost" onClick={() => setLocation("/debtors")}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CreateDebtorPage;
