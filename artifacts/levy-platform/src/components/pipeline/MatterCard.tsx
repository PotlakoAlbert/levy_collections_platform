import { useRef } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { GripVertical, FileText, Clock, MoreVertical, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatCurrency, PRIORITY_HEX_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MatterCardProps {
  id: string;
  reference: string;
  debtorName: string;
  capitalArrears: number;
  interest: number;
  legalCosts: number;
  totalPaid: number;
  priority: string;
  unit?: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  automationStatus?: string;
  nextAction?: string;
}

export function MatterCard({
  id,
  reference,
  debtorName,
  capitalArrears,
  interest,
  legalCosts,
  totalPaid,
  priority,
  unit,
  selected,
  onToggleSelect,
  automationStatus = "NO_TOUCH",
  nextAction,
}: MatterCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const outstanding = capitalArrears + interest + legalCosts - totalPaid;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "cursor-move transition-all duration-200 active:cursor-grabbing",
        isDragging && "ring-2 ring-primary"
      )}
    >
      <Card className="p-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <input type="checkbox" className="h-4 w-4" checked={!!selected} onChange={onToggleSelect} />
              <span
                {...listeners}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                title="Drag to move matter"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <Link href={`/matters/${id}`}>
                <p className="text-sm font-semibold text-primary truncate hover:underline cursor-pointer">
                  {reference}
                </p>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground truncate mb-2">
              {debtorName}
            </p>
            {unit && (
              <p className="text-xs text-muted-foreground truncate mb-2">
                {unit}
              </p>
            )}
            <div className="flex gap-1 flex-wrap mb-2">
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: PRIORITY_HEX_COLORS[priority] || "#999",
                  color: PRIORITY_HEX_COLORS[priority] || "#999",
                }}
              >
                {priority}
              </Badge>
              
              {/* Automation Status Badge */}
              {automationStatus === "NO_TOUCH" && (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Auto
                </Badge>
              )}
              {(automationStatus === "FLAGGED" || automationStatus === "MANUAL_REVIEW") && (
                <Badge className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-0 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Review
                </Badge>
              )}
            </div>
            <p className="text-sm font-bold text-foreground">
              {formatCurrency(outstanding)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Outstanding
            </p>
            {nextAction && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                Next: {nextAction}
              </p>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="flex-shrink-0 flex flex-col gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/matters/${id}`} className="cursor-pointer">
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/matters/${id}#documents`} className="cursor-pointer">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/matters/${id}#tasks`} className="cursor-pointer">
                    <Clock className="h-4 w-4 mr-2" />
                    Tasks
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>
    </div>
  );
}
