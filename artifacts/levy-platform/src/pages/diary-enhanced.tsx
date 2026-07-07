import { useState } from "react";
import { useListTasks, useUpdateTask, useCreateTask } from "@workspace/api-client-react";
import { PRIORITY_COLORS } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import { CheckCircle2, Clock, RefreshCw, Calendar, List, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isThisMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

export function DiaryPage() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "history">("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Manual task creation state
  const [manualTaskOpen, setManualTaskOpen] = useState(false);
  const [manualTask, setManualTask] = useState({
    title: "",
    description: "",
    priority: "NORMAL",
    dueDate: new Date().toISOString(),
  });

  const { data, isLoading } = useListTasks({ status: statusFilter as any });
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const raw = data as any;
  const tasks = Array.isArray(raw) ? raw : raw?.tasks ?? [];
  const total = raw?.total ?? (Array.isArray(raw) ? raw.length : 0);

  // Filter tasks for selected date in calendar view
  const tasksForDate = (date: Date) => {
    return tasks.filter((task: any) => {
      if (!task.dueDate) return false;
      return isSameDay(new Date(task.dueDate), date);
    });
  };

  // Get all days in current month
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  function completeTask(taskId: string) {
    updateTask.mutate(
      { id: taskId, status: "COMPLETED" } as any,
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }) }
    );
  }

  function deleteTask(taskId: string) {
    // Implement task deletion/archiving
    updateTask.mutate(
      { id: taskId, status: "ARCHIVED" } as any,
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }) }
    );
  }

  function handleCreateManualTask() {
    if (!manualTask.title) return;

    createTask.mutate(
      {
        title: manualTask.title,
        description: manualTask.description,
        priority: manualTask.priority as any,
        dueDate: new Date(manualTask.dueDate),
        taskType: "MANUAL",
        assigneeId: "current-user-id", // Should get from auth
        status: "PENDING",
      } as any,
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          setManualTask({ title: "", description: "", priority: "NORMAL", dueDate: new Date().toISOString() });
          setManualTaskOpen(false);
        },
      }
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
        <div className="flex gap-2">
          <Dialog open={manualTaskOpen} onOpenChange={setManualTaskOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Manual Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Task title"
                  value={manualTask.title}
                  onChange={(e) => setManualTask({ ...manualTask, title: e.target.value })}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={manualTask.description}
                  onChange={(e) => setManualTask({ ...manualTask, description: e.target.value })}
                />
                <Select value={manualTask.priority} onValueChange={(v) => setManualTask({ ...manualTask, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  type="date"
                  value={new Date(manualTask.dueDate).toISOString().split("T")[0]}
                  onChange={(e) => setManualTask({ ...manualTask, dueDate: new Date(e.target.value).toISOString() })}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <Button onClick={handleCreateManualTask} className="w-full">
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex gap-2 border rounded-md p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("history")}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
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
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <>
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
                <Card
                  key={task.id}
                  className={cn(
                    "transition-all hover:shadow-md",
                    task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && statusFilter === "PENDING"
                      ? "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                      : ""
                  )}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                          {task.isAutoGen ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              <RefreshCw className="h-2.5 w-2.5 mr-1" />
                              Auto
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Manual
                            </Badge>
                          )}
                          {getDueBadge(task.dueDate)}
                        </div>
                        <p className="font-semibold text-sm mb-1">{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground mb-2">{task.description}</p>}
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Due: {format(new Date(task.dueDate), "MMM dd, yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => completeTask(task.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTask(task.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{format(selectedDate, "MMMM yyyy")}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                  >
                    ← Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                  >
                    Next →
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center font-semibold text-sm p-2">
                    {day}
                  </div>
                ))}
                {daysInMonth.map((date) => {
                  const dayTasks = tasksForDate(date);
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => {
                        // Could add functionality to filter tasks for this date
                      }}
                      className={cn(
                        "p-3 border rounded-lg text-sm hover:bg-accent transition-colors",
                        isToday(date) && "bg-blue-50 border-blue-300",
                        dayTasks.length > 0 && "bg-green-50/50"
                      )}
                    >
                      <div className="font-semibold">{format(date, "d")}</div>
                      {dayTasks.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {dayTasks.slice(0, 2).map((task: any) => (
                            <div
                              key={task.id}
                              className="text-xs bg-green-200 text-green-900 px-2 py-1 rounded truncate"
                            >
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 2 && (
                            <div className="text-xs text-muted-foreground">+{dayTasks.length - 2} more</div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* HISTORY VIEW */}
      {viewMode === "history" && (
        <Card>
          <CardHeader>
            <CardTitle>Task History (Completed)</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.filter((t: any) => t.status === "COMPLETED").length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No completed tasks yet</p>
            ) : (
              <div className="space-y-3">
                {tasks
                  .filter((t: any) => t.status === "COMPLETED")
                  .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                  .map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-4 p-3 border rounded-lg bg-green-50/30"
                    >
                      <div>
                        <p className="font-semibold text-sm line-through text-muted-foreground">{task.title}</p>
                        {task.completionNote && (
                          <p className="text-xs text-muted-foreground mt-1">{task.completionNote}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Completed: {format(new Date(task.completedAt), "MMM dd, yyyy 'at' HH:mm")}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
