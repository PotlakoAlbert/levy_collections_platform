import { useState } from "react";
import { useListMatters, useGenerateDocument, useListDebtors, useGetDebtorMatters, useBulkGenerateDocuments } from "@workspace/api-client-react";
import { formatDate, STAGE_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

const DOC_TYPES = [
  { value: "LOD", label: "Letter of Demand" },
  { value: "S129", label: "Section 129 Notice" },
  { value: "SUMMONS", label: "Combined Summons" },
  { value: "JUDGMENT", label: "Default Judgment" },
  { value: "WRIT", label: "Writ of Execution" },
];

function DownloadButton({ matterId, matterRef }: { matterId: string; matterRef: string }) {
  const [docType, setDocType] = useState("LOD");
  const generateDoc = useGenerateDocument();
  const { toast } = useToast();

  function handleGenerate() {
    generateDoc.mutate(
      { data: { matterId, docType } } as any,
      {
        onSuccess: (data: any) => {
          const link = document.createElement("a");
          link.href = data.fileUrl;
          link.download = `${matterRef}_${docType}.html`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast({ title: "Document generated", description: `${docType} for ${matterRef} is ready.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to generate document", variant: "destructive" });
        }
      }
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={docType} onValueChange={setDocType}>
        <SelectTrigger className="w-48 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generateDoc.isPending}>
        {generateDoc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function DocumentsPage() {
  const [stageFilter, setStageFilter] = useState("ALL");
  const STAGES = ["ALL", "LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];
  const { data, isLoading } = useListMatters({ status: "ACTIVE" as any, stage: stageFilter !== "ALL" ? (stageFilter as any) : undefined });
  const { data: debtorsRaw } = useListDebtors();
  const [selectedDebtor, setSelectedDebtor] = useState<string | null>(null);
  const { data: debtorMatters } = useGetDebtorMatters(selectedDebtor || "", { query: { queryKey: ["debtorMatters", selectedDebtor], enabled: !!selectedDebtor } });
  const [selectedDocType, setSelectedDocType] = useState("LOD");
  const generateDocByDebtor = useGenerateDocument();
  const bulkGenerate = useBulkGenerateDocuments();
  const { toast } = useToast();
  const [selectedDialogMatterId, setSelectedDialogMatterId] = useState<string | null>(null);
  const [selectedMatterIds, setSelectedMatterIds] = useState<string[]>([]);
  const raw = data as any;
  const matters = Array.isArray(raw) ? raw : raw?.matters ?? [];

  function toggleSelect(matterId: string) {
    setSelectedMatterIds((prev) => (prev.includes(matterId) ? prev.filter((x) => x !== matterId) : [...prev, matterId]));
  }

  function toggleSelectAll() {
    if (matters.length === 0) return;
    const allSelected = selectedMatterIds.length === matters.length;
    setSelectedMatterIds(allSelected ? [] : matters.map((m: any) => m.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate legal documents for active matters — or pick a debtor below</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-72">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select debtor</label>
            <select className="w-full rounded-md border px-3 py-2" value={selectedDebtor ?? ""} onChange={(e) => setSelectedDebtor(e.target.value || null)}>
              <option value="">-- choose debtor --</option>
              {(Array.isArray(debtorsRaw) ? debtorsRaw : (debtorsRaw as any)?.debtors ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.fullName} ({d.idNumber ?? d.companyName ?? ''})</option>)}
            </select>
          </div>
          <div className="w-48">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage filter</label>
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v)}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s} value={s} className="text-xs">{s === "ALL" ? "All Stages" : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!selectedDebtor || !debtorMatters || debtorMatters.length === 0} onClick={() => setSelectedDialogMatterId(debtorMatters?.[0]?.id ?? null)}>
                  Generate for debtor
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Generate document for debtor</AlertDialogTitle>
                  <AlertDialogDescription>Choose a matter to use for document generation for the selected debtor.</AlertDialogDescription>
                </AlertDialogHeader>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Select matter</label>
                    <select className="w-full rounded-md border px-3 py-2 mt-1" value={selectedDialogMatterId ?? ""} onChange={(e) => setSelectedDialogMatterId(e.target.value || null)}>
                      <option value="">-- choose matter --</option>
                      {(debtorMatters || []).map((m: any) => <option key={m.id} value={m.id}>{m.reference} — {m.stage}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Document type</label>
                    <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                      <SelectTrigger className="w-48 h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    const docType = selectedDocType;
                    if (!selectedDialogMatterId) {
                      toast({ title: "Select matter", description: "Please choose a matter first", variant: "destructive" });
                    } else {
                      generateDocByDebtor.mutate({ data: { matterId: selectedDialogMatterId, docType } } as any, {
                        onSuccess: (data: any) => {
                          const link = document.createElement("a");
                          link.href = data.fileUrl;
                          link.download = `${data.matterReference ?? selectedDialogMatterId}_${docType}.html`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast({ title: "Document generated", description: `${docType} is ready.` });
                          setSelectedDialogMatterId(null);
                        },
                        onError: () => {
                          toast({ title: "Error", description: "Failed to generate document", variant: "destructive" });
                        }
                      });
                    }
                  }}>Generate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Bulk Document Generation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : matters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No active matters</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" checked={selectedMatterIds.length === matters.length && matters.length > 0} onChange={toggleSelectAll} />
                  <span className="text-sm text-muted-foreground">{selectedMatterIds.length} selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={selectedMatterIds.length === 0} onClick={() => {
                    bulkGenerate.mutate({ data: { matterIds: selectedMatterIds, docType: selectedDocType } } as any, {
                      onSuccess: (res: any) => {
                        (res.documents || []).forEach((doc: any) => {
                          const link = document.createElement("a");
                          link.href = doc.fileUrl;
                          link.download = doc.fileName || `${doc.matterReference || doc.matterId}_${selectedDocType}.html`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        });
                        toast({ title: "Bulk generate complete", description: `${res.generated} generated, ${res.failed} failed` });
                        setSelectedMatterIds([]);
                      },
                      onError: () => {
                        toast({ title: "Error", description: "Bulk generation failed", variant: "destructive" });
                      }
                    });
                  }}>Bulk generate</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (stageFilter === "ALL") return;
                    const ids = matters.filter((m: any) => m.stage === stageFilter).map((m: any) => m.id);
                    setSelectedMatterIds(ids);
                  }} title="Select all matters in selected stage">Select stage</Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="pb-3 pr-4 text-left w-8"> </th>
                      <th className="pb-3 pr-4 text-left">Reference</th>
                      <th className="pb-3 pr-4 text-left">Debtor</th>
                      <th className="pb-3 pr-4 text-left">Stage</th>
                      <th className="pb-3 pr-4 text-left">LOD Date</th>
                      <th className="pb-3 text-left">Generate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {matters.map((matter: any) => (
                      <tr key={matter.id} className="hover:bg-muted/40">
                        <td className="py-3 pr-4">
                          <input type="checkbox" className="h-4 w-4" checked={selectedMatterIds.includes(matter.id)} onChange={() => toggleSelect(matter.id)} />
                        </td>
                        <td className="py-3 pr-4 font-mono font-semibold text-primary text-sm">{matter.reference}</td>
                        <td className="py-3 pr-4">
                          {matter.debtorName || "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={cn("text-xs", STAGE_COLORS[matter.stage])}>
                            {matter.stage}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{formatDate(matter.lodDate)}</td>
                        <td className="py-3">
                          <DownloadButton matterId={matter.id} matterRef={matter.reference} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
