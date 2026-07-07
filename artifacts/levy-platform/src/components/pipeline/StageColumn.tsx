import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MatterCard } from "./MatterCard";
import { STAGE_HEX_COLORS, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

interface Matter {
  id: string;
  reference: string;
  debtorName: string;
  capitalArrears: number;
  interest: number;
  legalCosts: number;
  totalPaid: number;
  priority: string;
  unit?: string;
  automationStatus?: string;
  nextAction?: string;
}

interface StageColumnProps {
  stage: string;
  matters: Matter[];
  isLoading?: boolean;
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
}

export function StageColumn({
  stage,
  matters,
  isLoading,
  selectedIds,
  toggleSelect,
}: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  const matterIds = matters.map((m) => m.id);
  const totalOutstanding = matters.reduce(
    (sum, m) => sum + m.capitalArrears + m.interest + m.legalCosts - m.totalPaid,
    0
  );
  
  // Calculate critical and high priority counts
  const criticalCount = matters.filter((m) => m.priority === "CRITICAL").length;
  const highCount = matters.filter((m) => m.priority === "HIGH").length;
  
  // Calculate automation statistics
  const noTouchCount = matters.filter((m) => m.automationStatus === "NO_TOUCH").length;
  const flaggedCount = matters.filter((m) => m.automationStatus === "FLAGGED" || m.automationStatus === "MANUAL_REVIEW").length;
  const automationRate = matters.length > 0 ? ((noTouchCount / matters.length) * 100).toFixed(0) : 0;

  const stageColor = STAGE_HEX_COLORS[stage] || "#999";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[340px] h-full rounded-lg border-2 transition-all duration-200",
        isOver ? "border-primary bg-primary/5 scale-105" : "border-muted-foreground/20 bg-muted/5"
      )}
    >
      {/* Header */}
      <div
        className="p-4 border-b rounded-t-md"
        style={{ backgroundColor: `${stageColor}10`, borderColor: stageColor }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{stage}</h3>
            {(criticalCount > 0 || highCount > 0 || flaggedCount > 0) && (
              <div className="flex gap-1">
                {criticalCount > 0 && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-xs">
                    {criticalCount} critical
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 text-xs">
                    {highCount} high
                  </Badge>
                )}
                {flaggedCount > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {flaggedCount} review
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {matters.length}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">
              {formatCurrency(totalOutstanding)}
            </p>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          
          {/* Automation indicator */}
          {matters.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-current border-opacity-10">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <p className="text-xs text-muted-foreground">
                {noTouchCount}/{matters.length} automated ({automationRate}%)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Matters Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : matters.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <div className="opacity-50 mb-2">📭</div>
            <p>No matters</p>
            <p className="text-xs mt-1">Drag matters here to move them</p>
          </div>
        ) : (
          <SortableContext
            items={matterIds}
            strategy={verticalListSortingStrategy}
          >
            {matters.map((matter) => (
              <MatterCard 
                key={matter.id} 
                {...matter} 
                selected={selectedIds?.includes(matter.id)} 
                onToggleSelect={() => toggleSelect?.(matter.id)}
                automationStatus={matter.automationStatus}
                nextAction={matter.nextAction}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
