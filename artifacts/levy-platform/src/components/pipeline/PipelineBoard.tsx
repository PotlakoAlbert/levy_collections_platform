import React, { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useListMatters, useUpdateMatterStage, useListAgents } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StageColumn } from "./StageColumn";
import { PipelineControls } from "./PipelineControls";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, STAGE_HEX_COLORS } from "@/lib/utils";
import { Search, RotateCw, Filter, X } from "lucide-react";

const STAGES = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

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
  agentName?: string;
}

interface PipelineStats {
  totalOutstanding: number;
  totalMatters: number;
  criticalCount: number;
  highCount: number;
}

export function PipelineBoard() {
  const [mattersState, setMattersState] = useState<Record<string, MatterData[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDrag, setPendingDrag] = useState<{
    matterId: string;
    fromStage: string;
    toStage: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateStage = useUpdateMatterStage();
  
  // Fetch agents for filter
  const { data: agentsData } = useListAgents();
  const agents = useMemo(() => 
    Array.isArray(agentsData) ? agentsData : agentsData?.agents || [], 
    [agentsData]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    })
  );

  // Fetch all matters for the board
  const { data: allMattersData, isLoading, isError, refetch } = useListMatters({
    limit: 1000,
  });

  // Organize and filter matters by stage
  React.useEffect(() => {
    if (allMattersData) {
      const organized: Record<string, MatterData[]> = {};
      STAGES.forEach((stage) => {
        organized[stage] = [];
      });

      const matters = Array.isArray(allMattersData) ? allMattersData : allMattersData?.matters || [];
      
      matters.forEach((matter: any) => {
        // Apply filters
        const matchesSearch = 
          matter.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          matter.debtorName?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesPriority = !selectedPriority || matter.priority === selectedPriority;
        const matchesAgent = !selectedAgent || matter.agentName === selectedAgent;
        const matchesStage = !selectedStage || matter.stage === selectedStage;

        if (matchesSearch && matchesPriority && matchesAgent && matchesStage && organized[matter.stage]) {
          organized[matter.stage].push(matter);
        }
      });

      setMattersState(organized);
    }
  }, [allMattersData, searchQuery, selectedPriority, selectedAgent, selectedStage]);

  // Calculate statistics
  const stats = useMemo((): PipelineStats => {
    let totalOutstanding = 0;
    let totalMatters = 0;
    let criticalCount = 0;
    let highCount = 0;

    Object.values(mattersState).forEach((matters) => {
      matters.forEach((matter) => {
        totalMatters++;
        totalOutstanding += matter.capitalArrears + matter.interest + matter.legalCosts - matter.totalPaid;
        if (matter.priority === "CRITICAL") criticalCount++;
        if (matter.priority === "HIGH") highCount++;
      });
    });

    return { totalOutstanding, totalMatters, criticalCount, highCount };
  }, [mattersState]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeMatterId = active.id;
    const overStage = over.id as string;

    // Find which stage the matter is currently in
    let currentStage = "";
    for (const stage of STAGES) {
      if (
        mattersState[stage]?.some(
          (m: MatterData) => m.id === activeMatterId
        )
      ) {
        currentStage = stage;
        break;
      }
    }

    if (currentStage && currentStage !== overStage) {
      // Preview: move matter to new stage temporarily
      setMattersState((prev) => {
        const newState = { ...prev };
        const matter = newState[currentStage]?.find(
          (m: MatterData) => m.id === activeMatterId
        );
        if (matter) {
          newState[currentStage] = newState[currentStage]?.filter(
            (m: MatterData) => m.id !== activeMatterId
          );

          if (!newState[overStage]) {
            newState[overStage] = [];
          }
          newState[overStage]?.unshift(matter);
        }
        return newState;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) return;

    const matterId = active.id as string;
    const toStage = over.id as string;

    // Find current stage
    let fromStage = "";
    for (const stage of STAGES) {
      if (
        mattersState[stage]?.some((m: MatterData) => m.id === matterId)
      ) {
        fromStage = stage;
        break;
      }
    }

    if (fromStage === toStage) return;

    if (STAGES.includes(toStage as string)) {
      // Show confirmation dialog
      setPendingDrag({ matterId, fromStage, toStage });
      setConfirmOpen(true);
    }
  };

  const confirmStageChange = () => {
    if (!pendingDrag) return;

    const { matterId, fromStage, toStage } = pendingDrag;

    // Call API
    updateStage.mutate(
      { id: matterId, data: { stage: toStage } },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: `Matter moved to ${toStage}`,
          });
          queryClient.invalidateQueries({ queryKey: ["matters"] });
          queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
          setConfirmOpen(false);
          setPendingDrag(null);
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: "Failed to update stage. Changes reverted.",
            variant: "destructive",
          });
          // Revert optimistic update by reloading
          setMattersState((prev) => {
            const newState = { ...prev };
            const matter = newState[toStage]?.find(
              (m: MatterData) => m.id === matterId
            );
            if (matter) {
              newState[toStage] = newState[toStage]?.filter(
                (m: MatterData) => m.id !== matterId
              );
              if (!newState[fromStage]) {
                newState[fromStage] = [];
              }
              newState[fromStage]?.unshift(matter);
            }
            return newState;
          });
          setConfirmOpen(false);
          setPendingDrag(null);
        },
      }
    );
  };

  const sortedMatters = (stage: string): MatterData[] => {
    const matters = mattersState[stage] || [];
    return [...matters].sort(
      (a: MatterData, b: MatterData) => {
        const priorityOrder: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      }
    );
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedPriority("");
    setSelectedAgent("");
    setSelectedStage("");
  };

  const hasActiveFilters = searchQuery || selectedPriority || selectedAgent || selectedStage;

  // Get all matters for export
  const allMatters = useMemo(() => {
    return Object.values(mattersState).flat();
  }, [mattersState]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag matters across stages to advance collection process
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding)}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.totalMatters} matters</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Critical Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.highCount}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average per Matter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalMatters > 0 ? formatCurrency(stats.totalOutstanding / stats.totalMatters) : formatCurrency(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference or debtor name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {agents.length > 0 && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.name}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}

            {!isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2"
              >
                <RotateCw className="h-4 w-4" />
                Refresh
              </Button>
            )}

            <PipelineControls allMatters={allMatters} isLoading={isLoading} />
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Failed to load matters. <Button variant="link" className="p-0 h-auto" onClick={() => refetch()}>Try again</Button>
          </p>
        </div>
      )}

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-4 min-w-max pr-6">
              {STAGES.map((stage) => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  matters={sortedMatters(stage)}
                  isLoading={false}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stage Change</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            Are you sure you want to move this matter from <strong>{pendingDrag?.fromStage}</strong> to <strong>{pendingDrag?.toStage}</strong>?
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStageChange}
              disabled={updateStage.isPending}
            >
              {updateStage.isPending ? "Moving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

