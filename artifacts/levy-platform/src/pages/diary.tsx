import { useState } from "react";
import { useListTasks, useUpdateTask } from "@workspace/api-client-react";
import { PRIORITY_COLORS } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export function DiaryPage() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useListTasks({ page, limit: 30, status: statusFilter as any });

  const updateTask = useUpdateTask();

  const tasks = (data as any)?.tasks ?? [];
  const total = (data as any)?.total ?? 0;

  function completeTask(taskId: string) {
    updateTask.mutate(
      { id: taskId, status: "COMPLETED" } as any,
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }) }
    );
  }

  function getDueBadge(dueDate: string | null) {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    if (isPast(d) && !isToday(d)) return <Badge variant="destructive" className="text-[10px]">Overdue</Badge>;
    if (isToday(d)) return <Badge className="text-[10px] bg-orange-500">Due Today</Badge>;
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diary</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} tasks</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="SNOOZED">Snoozed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
            <p>No {statusFilter.toLowerCase()} tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task: any) => (
            <Card key={task.id} className={cn(
              "transition-all",
              task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && statusFilter === "PENDING"
                ? "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                : ""
            )}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {task.matterReference && (
                        <Link href={`/matters/${task.matterId}`}>
                          <span className="text-xs font-mono font-semibold text-primary hover:underline cursor-pointer">
                            {task.matterReference}
                          </span>
                        </Link>
                      )}
                      <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </Badge>
                      {task.isAutoGen && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <RefreshCw className="h-2.5 w-2.5 mr-1" />Auto
                        </Badge>
                      )}
                      {getDueBadge(task.dueDate)}
                    </div>
                    <p className="font-medium text-sm">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.dueDate), "dd MMM yyyy")}
                        </span>
                      )}
                      {task.assigneeName && (
                        <span>{task.assigneeName}</span>
                      )}
                    </div>
                  </div>
                  {statusFilter === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      onClick={() => completeTask(task.id)}
                      disabled={updateTask.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Done
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {Math.ceil(total / 30) > 1 && (
        <div className="flex justify-between items-center pt-2">
          <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 30)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
