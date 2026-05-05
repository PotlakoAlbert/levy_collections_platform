import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GenerateTasksDialogProps {
  matterId: string;
  stage: string;
  onSuccess?: () => void;
}

interface TaskTemplate {
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDaysFromNow: number;
}

const STAGE_TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  LOD: [
    {
      title: "Letter of Demand dispatched",
      description: "Confirm LOD sent via WhatsApp/email/post. Record method of dispatch.",
      priority: "NORMAL",
      dueDaysFromNow: 0,
    },
    {
      title: "Await LOD response period",
      description: "10 business days response period. If no response or payment, proceed to Section 129.",
      priority: "HIGH",
      dueDaysFromNow: 10,
    },
  ],
  S129: [
    {
      title: "Section 129 notice dispatched",
      description: "Send S129 notice via registered post (required by NCA). Record tracking number.",
      priority: "HIGH",
      dueDaysFromNow: 0,
    },
    {
      title: "S129 response period expires",
      description: "10 business days from delivery. If no response, proceed to issue summons.",
      priority: "HIGH",
      dueDaysFromNow: 12,
    },
  ],
  SUMMONS: [
    {
      title: "Issue summons",
      description: "Prepare and issue combined summons. Confirm correct court jurisdiction.",
      priority: "HIGH",
      dueDaysFromNow: 0,
    },
    {
      title: "Lodge summons with Sheriff",
      description: "Deliver summons to Sheriff for service. Record Sheriff reference.",
      priority: "HIGH",
      dueDaysFromNow: 2,
    },
    {
      title: "Follow up return of service",
      description: "Confirm Sheriff has served summons. Obtain return of service.",
      priority: "NORMAL",
      dueDaysFromNow: 10,
    },
    {
      title: "Check for Notice of Intention to Defend",
      description: "If no NID filed within 10 days of service, proceed to default judgment.",
      priority: "HIGH",
      dueDaysFromNow: 15,
    },
  ],
  JUDGMENT: [
    {
      title: "Apply for default judgment",
      description: "Prepare and file default judgment application with court.",
      priority: "HIGH",
      dueDaysFromNow: 0,
    },
    {
      title: "Follow up judgment grant",
      description: "Check with court if judgment has been granted. Obtain stamped order.",
      priority: "NORMAL",
      dueDaysFromNow: 5,
    },
    {
      title: "Apply for writ of execution",
      description: "Once judgment granted, prepare writ of execution against immovable property.",
      priority: "HIGH",
      dueDaysFromNow: 7,
    },
  ],
  WRIT: [
    {
      title: "Writ issued — instruct Sheriff",
      description: "Lodge writ with Sheriff of the Court. Provide property description and debtor details.",
      priority: "HIGH",
      dueDaysFromNow: 2,
    },
    {
      title: "Confirm attachment",
      description: "Follow up with Sheriff to confirm property has been attached.",
      priority: "HIGH",
      dueDaysFromNow: 10,
    },
  ],
  RULE46: [
    {
      title: "Prepare Rule 46(1) notice",
      description: "Draft Rule 46(1)(a)(ii) notice of sale in execution of immovable property.",
      priority: "HIGH",
      dueDaysFromNow: 0,
    },
    {
      title: "Section 15 STSMA joinder",
      description: "Serve joinder notice on body corporate members per Section 15 of STSMA.",
      priority: "HIGH",
      dueDaysFromNow: 3,
    },
    {
      title: "Serve Rule 46 notice on debtor",
      description: "Serve notice on debtor giving required notice period before sale.",
      priority: "HIGH",
      dueDaysFromNow: 5,
    },
    {
      title: "Check for opposition",
      description: "Monitor for any opposition to sale. Deadline for opposition filing.",
      priority: "URGENT",
      dueDaysFromNow: 20,
    },
  ],
  SALE: [
    {
      title: "Confirm sale date with Sheriff",
      description: "Coordinate sale in execution date. Confirm property valuation obtained.",
      priority: "URGENT",
      dueDaysFromNow: 0,
    },
    {
      title: "Advertise sale",
      description: "Ensure sale is advertised as required by court rules.",
      priority: "HIGH",
      dueDaysFromNow: 5,
    },
    {
      title: "Attend sale in execution",
      description: "Attorney/representative to attend sale. Ensure reserve price met.",
      priority: "URGENT",
      dueDaysFromNow: 20,
    },
    {
      title: "Transfer and distribution",
      description: "After sale: handle transfer, distribute proceeds, close matter.",
      priority: "HIGH",
      dueDaysFromNow: 25,
    },
  ],
  CLOSED: [],
};

export function GenerateTasksDialog({
  matterId,
  stage,
  onSuccess,
}: GenerateTasksDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const templates = STAGE_TASK_TEMPLATES[stage] || [];

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch(`/api/matters/${matterId}/generate-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate tasks");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: `Generated ${result.count || templates.length} tasks for ${stage} stage`,
      });

      queryClient.invalidateQueries({ queryKey: ["matter", matterId] });
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate tasks",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (templates.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          No standard tasks for {stage} stage.
        </p>
      </Card>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Generate Tasks
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[95vw] max-w-sm sm:max-w-md md:max-w-lg mx-auto p-4 sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base sm:text-lg">Generate Tasks for {stage} Stage</AlertDialogTitle>
          <AlertDialogDescription className="text-xs sm:text-sm">
            This will create {templates.length} standard tasks based on BAM Attorneys' levy collection procedures.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-3 sm:py-4 max-h-[70vh] overflow-y-auto">
          <Alert className="text-xs sm:text-sm">
            <AlertDescription>
              These are standard tasks for the {stage} stage. You can edit or delete individual tasks after creation.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            {templates.map((template, idx) => (
              <div key={idx} className="p-2 sm:p-3 bg-muted/50 rounded-lg border border-muted-foreground/20">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-xs sm:text-sm leading-snug">{template.title}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap shrink-0">
                    +{template.dueDaysFromNow}d
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {template.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2 w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Generate All Tasks
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
