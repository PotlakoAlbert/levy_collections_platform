import { useState } from "react";
import { useListMatters, useGenerateDocument } from "@workspace/api-client-react";
import { formatDate, STAGE_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
      { matterId, documentType: docType } as any,
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
  const { data, isLoading } = useListMatters({ page: 1, limit: 50, status: "ACTIVE" as any });
  const matters = (data as any)?.matters ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate legal documents for active matters</p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
