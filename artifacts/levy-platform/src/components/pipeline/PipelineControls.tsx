import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, MoreVertical, FileText, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MatterData {
  id: string;
  reference: string;
  debtorName: string;
  capitalArrears: number;
  interest: number;
  legalCosts: number;
  totalPaid: number;
  priority: string;
  unit?: string;
  stage: string;
}

interface PipelineControlsProps {
  allMatters: MatterData[];
  isLoading?: boolean;
}

export function PipelineControls({ allMatters, isLoading }: PipelineControlsProps) {
  const { toast } = useToast();

  const exportAsCSV = () => {
    if (!allMatters || allMatters.length === 0) {
      toast({
        title: "No data",
        description: "No matters to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Reference",
      "Debtor",
      "Unit",
      "Stage",
      "Priority",
      "Capital Arrears",
      "Interest",
      "Legal Costs",
      "Total Paid",
      "Outstanding",
    ];

    const rows = allMatters.map((matter) => [
      matter.reference,
      matter.debtorName,
      matter.unit || "",
      matter.stage,
      matter.priority,
      matter.capitalArrears,
      matter.interest,
      matter.legalCosts,
      matter.totalPaid,
      matter.capitalArrears + matter.interest + matter.legalCosts - matter.totalPaid,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pipeline-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${allMatters.length} matters to CSV`,
    });
  };

  const exportSummary = () => {
    const stages = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];
    const summary: Record<string, any> = {};

    stages.forEach((stage) => {
      const stageMatters = allMatters.filter((m) => m.stage === stage);
      const totalOutstanding = stageMatters.reduce(
        (sum, m) => sum + m.capitalArrears + m.interest + m.legalCosts - m.totalPaid,
        0
      );

      summary[stage] = {
        count: stageMatters.length,
        totalOutstanding,
      };
    });

    const headers = ["Stage", "Count", "Outstanding"];
    const rows = stages.map((stage) => [
      stage,
      summary[stage].count,
      summary[stage].totalOutstanding,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pipeline-summary-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: "Exported pipeline summary to CSV",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || allMatters.length === 0}
          className="gap-2"
        >
          <MoreVertical className="h-4 w-4" />
          More
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={exportAsCSV} className="gap-2 cursor-pointer">
          <Download className="h-4 w-4" />
          <span>Export All (CSV)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportSummary} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          <span>Export Summary</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 text-xs opacity-50">
          <Share2 className="h-4 w-4" />
          <span>Share Pipeline (Coming soon)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
