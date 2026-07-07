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
import { 
  Search, RotateCw, Filter, X, AlertTriangle, CheckCircle2, Clock, 
  Zap, RefreshCw, Eye, EyeOff, Settings
} from "lucide-react";

const STAGES = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];
const STAGE_CATEGORIES = {
  "intake": { stages: ["LOD"], label: "Intake & Digitization", color: "#3b82f6" },
  "validation": { stages: ["S129"], label: "Validation & Verification", color: "#8b5cf6" },
  "compliance": { stages: ["SUMMONS", "JUDGMENT", "WRIT", "RULE46"], label: "Compliance & Response", color: "#f97316" },
  "resolution": { stages: ["SALE", "CLOSED"], label: "Resolution", color: "#10b981" }
};
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const AUTOMATION_STATUSES = ["NO_TOUCH", "FLAGGED", "MANUAL_REVIEW", "ALL"];

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
  automationStatus?: string; // "NO_TOUCH", "FLAGGED", "MANUAL_REVIEW"
  requiresManualReview?: boolean;
  lastActionDate?: string;
  nextAction?: string;
}

interface PipelineStats {
  totalOutstanding: number;
  totalMatters: number;
  criticalCount: number;
  highCount: number;
  manualReviewCount: number;
  noTouchCount: number;
}

export function PipelineBoard() {
  const [mattersState, setMattersState] = useState<Record<string, MatterData[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedMatterIds, setSelectedMatterIds] = useState<string[]>([]);
  const [bulkTargetStage, setBulkTargetStage] = useState<string>("");
  const [pendingDrag, setPendingDrag] = useState<{
    matterIds: string[];
    fromStage: string;
    toStage: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [automationFilter, setAutomationFilter] = useState<string>("ALL");
  const [viewByCategory, setViewByCategory] = useState(true);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateStage = useUpdateMatterStage();
  
  // Fetch agents for filter
  const { data: agentsData } = useListAgents();
  const agents = useMemo(() => 
    ((agentsData as any) && (Array.isArray(agentsData) ? agentsData : (agentsData as any).agents)) || [],
    [agentsData]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const toggleSelect = (id: string) => {
    setSelectedMatterIds((prev) => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Fetch all matters for the board
  const { data: allMattersData, isLoading, isError, refetch } = useListMatters();

  // Organize and filter matters by stage
  React.useEffect(() => {
    if (allMattersData) {
      const organized: Record<string, MatterData[]> = {};
      STAGES.forEach((stage) => {
        organized[stage] = [];
      });

      // Handle both array and object responses from API
      const mattersArray = Array.isArray(allMattersData)
        ? allMattersData
        : ((allMattersData as any)?.data ?? (allMattersData as any)?.matters ?? []);
      
      mattersArray.forEach((matter: any) => {
        // Apply filters
        const matchesSearch = 
          matter.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          matter.debtorName?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesPriority = !selectedPriority || matter.priority === selectedPriority;
        const matchesAgent = !selectedAgent || matter.agentName === selectedAgent;
        const matchesStage = !selectedStage || matter.stage === selectedStage;
        
        // Automation status filter
        const automationStatus = matter.automationStatus || (matter.requiresManualReview ? "FLAGGED" : "NO_TOUCH");
        const matchesAutomation = 
          automationFilter === "ALL" || 
          automationStatus === automationFilter;

        if (matchesSearch && matchesPriority && matchesAgent && matchesStage && matchesAutomation && organized[matter.stage]) {
          organized[matter.stage].push({
            ...matter,
            automationStatus: automationStatus
          });
        }
      });

      setMattersState(organized);
    }
  }, [allMattersData, searchQuery, selectedPriority, selectedAgent, selectedStage, automationFilter]);

  // Calculate statistics
  const stats = useMemo((): PipelineStats => {
    let totalOutstanding = 0;
    let totalMatters = 0;
    let criticalCount = 0;
    let highCount = 0;
    let manualReviewCount = 0;
    let noTouchCount = 0;

    Object.values(mattersState).forEach((matters) => {
      matters.forEach((matter) => {
        totalMatters++;
        totalOutstanding += matter.capitalArrears + matter.interest + matter.legalCosts - matter.totalPaid;
        if (matter.priority === "CRITICAL") criticalCount++;
        if (matter.priority === "HIGH") highCount++;
        
        const status = matter.automationStatus || (matter.requiresManualReview ? "FLAGGED" : "NO_TOUCH");
        if (status === "FLAGGED" || status === "MANUAL_REVIEW") manualReviewCount++;
        if (status === "NO_TOUCH") noTouchCount++;
      });
    });

    return { totalOutstanding, totalMatters, criticalCount, highCount, manualReviewCount, noTouchCount };
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
      // If the dragged card is part of the selection, we'll move all selected
      const multi = selectedMatterIds.includes(matterId) && selectedMatterIds.length > 0;
      const matterIds = multi ? selectedMatterIds : [matterId];

      // Show confirmation dialog for one or many matters
      setPendingDrag({ matterIds, fromStage, toStage });
      setConfirmOpen(true);
    }
  };

  const confirmStageChange = () => {
    if (!pendingDrag) return;

    const { matterIds, fromStage, toStage } = pendingDrag;

    // Optimistic UI: move matters locally first
    setMattersState((prev) => {
      const newState = { ...prev };
      matterIds.forEach((id) => {
        const matter = newState[fromStage]?.find((m: MatterData) => m.id === id);
        if (matter) {
          newState[fromStage] = newState[fromStage]?.filter((m: MatterData) => m.id !== id);
          if (!newState[toStage]) newState[toStage] = [];
          newState[toStage]?.unshift(matter);
        }
      });
      return newState;
    });

    // Call API for all selected matters
    (async () => {
      try {
        const promises = matterIds.map(
          (id) =>
            new Promise<void>((resolve, reject) => {
              updateStage.mutate({ id, data: { stage: toStage } }, {
                onSuccess: () => resolve(),
                onError: (e) => reject(e),
              });
            })
        );
        await Promise.all(promises);

        toast({ title: "Success", description: `Moved ${matterIds.length} matter(s) to ${toStage}` });
        setSelectedMatterIds((prev) => prev.filter((id) => !matterIds.includes(id)));
        queryClient.invalidateQueries({ queryKey: ["matters"] });
        queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      } catch (e) {
        toast({ title: "Error", description: "Failed to move some matters. Reverting.", variant: "destructive" });
        // Revert optimistic update by refetching server data
        queryClient.invalidateQueries({ queryKey: ["matters"] });
        queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      } finally {
        setConfirmOpen(false);
        setPendingDrag(null);
      }
    })();
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
    setAutomationFilter("ALL");
  };

  const hasActiveFilters = searchQuery || selectedPriority || selectedAgent || selectedStage || automationFilter !== "ALL";

  // Get all matters for export
  const allMatters = useMemo(() => {
    return Object.values(mattersState).flat();
  }, [mattersState]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Collections Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time visibility into levy lifecycle. Click any metric to drill down into specific cases.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewByCategory ? "default" : "outline"}
              size="sm"
              onClick={() => setViewByCategory(!viewByCategory)}
              className="gap-2"
            >
              {viewByCategory ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {viewByCategory ? "Category View" : "Stage View"}
            </Button>
          </div>
        </div>

        {/* Critical Alerts */}
        {(stats.manualReviewCount > 0 || stats.criticalCount > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.manualReviewCount > 0 && (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-base text-orange-900 dark:text-orange-100">
                      {stats.manualReviewCount} Require Manual Review
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                    Cases that couldn't be digitized or require special attention are flagged below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutomationFilter("FLAGGED")}
                    className="bg-orange-600 text-white hover:bg-orange-700 border-0"
                  >
                    View Flagged Cases →
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {stats.criticalCount > 0 && (
              <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-base text-red-900 dark:text-red-100">
                      {stats.criticalCount} Critical Priority
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                    Cases requiring immediate action due to approaching deadlines or urgent status.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPriority("CRITICAL")}
                    className="bg-red-600 text-white hover:bg-red-700 border-0"
                  >
                    View Critical Cases →
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">No-Touch Automated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                {stats.noTouchCount}
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Processed automatically</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Manual Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                {stats.manualReviewCount}
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Need attention</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Critical Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Urgent action</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Automation Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalMatters > 0 ? `${((stats.noTouchCount / stats.totalMatters) * 100).toFixed(0)}%` : "0%"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Successfully automated</p>
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

            <Select value={automationFilter} onValueChange={setAutomationFilter}>
              <SelectTrigger className="w-[150px]">
                <Zap className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Automation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Cases</SelectItem>
                <SelectItem value="NO_TOUCH">No-Touch</SelectItem>
                <SelectItem value="FLAGGED">Flagged</SelectItem>
                <SelectItem value="MANUAL_REVIEW">Manual Review</SelectItem>
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
            {selectedMatterIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={bulkTargetStage} onValueChange={setBulkTargetStage}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Move to" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={async () => {
                  if (!bulkTargetStage) return;
                  try {
                    const promises = selectedMatterIds.map((id) => new Promise((resolve, reject) => {
                      updateStage.mutate({ id, data: { stage: bulkTargetStage } }, {
                        onSuccess: () => resolve(true),
                        onError: (e) => reject(e),
                      });
                    }));
                    await Promise.all(promises);
                    toast({ title: "Moved", description: `Moved ${selectedMatterIds.length} matters to ${bulkTargetStage}` });
                    setSelectedMatterIds([]);
                    setBulkTargetStage("");
                    queryClient.invalidateQueries({ queryKey: ["matters"] });
                  } catch (e) {
                    toast({ title: "Error", description: "Failed to move some matters", variant: "destructive" });
                  }
                }}>Move Selected</Button>
              </div>
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
          {viewByCategory ? (
            /* Category View */
            <div className="space-y-6">
              {Object.entries(STAGE_CATEGORIES).map(([categoryKey, category]) => (
                <div key={categoryKey} className="space-y-3">
                  <div className="flex items-center gap-3 pl-2">
                    <div 
                      className="w-1 h-6 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <h2 className="text-lg font-semibold text-muted-foreground">{category.label}</h2>
                    <Badge variant="outline" className="text-xs">
                      {(category.stages as typeof STAGES).reduce((sum, stage) => sum + (mattersState[stage]?.length || 0), 0)} matters
                    </Badge>
                  </div>
                  <div className="overflow-x-auto pb-6">
                    <div className="flex gap-4 min-w-max pr-6">
                      {(category.stages as typeof STAGES).map((stage) => (
                        <StageColumn
                          key={stage}
                          stage={stage}
                          matters={sortedMatters(stage)}
                          selectedIds={selectedMatterIds}
                          toggleSelect={toggleSelect}
                          isLoading={false}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Stage View */
            <div className="overflow-x-auto pb-6">
              <div className="flex gap-4 min-w-max pr-6">
                {STAGES.map((stage) => (
                  <StageColumn
                    key={stage}
                    stage={stage}
                    matters={sortedMatters(stage)}
                    selectedIds={selectedMatterIds}
                    toggleSelect={toggleSelect}
                    isLoading={false}
                  />
                ))}
              </div>
            </div>
          )}
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

