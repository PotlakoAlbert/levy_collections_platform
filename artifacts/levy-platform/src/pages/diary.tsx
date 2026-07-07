import { useState } from "react";
import { useListTasks, useUpdateTask, useCreateTask, useListMatters, useListUsers } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_COLORS } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, Clock, RefreshCw, Archive, ArchiveRestore } from "lucide-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export function DiaryPage() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Create / edit task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "NORMAL", dueDate: "", matterId: "", assigneeId: "" });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const createTask = useCreateTask();
  const listMatters = useListMatters();
  const { data: usersData } = useListUsers();

  const listParams = statusFilter === "ARCHIVED"
    ? ({ archivedOnly: "true" } as any)
    : ({ status: statusFilter as any });
  const { data, isLoading } = useListTasks(listParams);

  const updateTask = useUpdateTask();

  const raw = data as any;
  const tasks = Array.isArray(raw) ? raw : raw?.tasks ?? [];
  const total = raw?.total ?? (Array.isArray(raw) ? raw.length : 0);

  function completeTask(taskId: string) {
    updateTask.mutate(
      { id: taskId, status: "COMPLETED" } as any,
      { onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overdue-tasks"] });
      } }
    );
  }

  async function archiveTask(taskId: string) {
    await customFetch(`/api/tasks/${taskId}/archive`, { method: "PATCH" });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overdue-tasks"] });
  }

  async function unarchiveTask(taskId: string) {
    await customFetch(`/api/tasks/${taskId}/unarchive`, { method: "PATCH" });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overdue-tasks"] });
  }

  function openCreate() {
    setEditingTask(null);
    setForm({ title: "", description: "", priority: "NORMAL", dueDate: "", matterId: "", assigneeId: "" });
    setTaskModalOpen(true);
  }

  function openEdit(t: any) {
    setEditingTask(t);
    setForm({
      title: t.title || "",
      description: t.description || "",
      priority: t.priority || "NORMAL",
      dueDate: t.dueDate ? t.dueDate.split("T")[0] : "",
      matterId: t.matterId ?? "",
      assigneeId: t.assigneeId ?? "",
    });
    setTaskModalOpen(true);
  }

  async function handleSave() {
    if (!form.title) return;
    if (editingTask) {
      // update
      await updateTask.mutateAsync({ id: editingTask.id, title: form.title, description: form.description, priority: form.priority, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null, assigneeId: form.assigneeId || null } as any);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskModalOpen(false);
      return;
    }

    // create requires matterId and assigneeId per API; fallback to first matter or empty string
    const matterId = form.matterId || (Array.isArray(listMatters.data) && listMatters.data[0]?.id) || "";
    const assigneeId = form.assigneeId || (Array.isArray(usersData) && usersData[0]?.id) || "";
    if (!matterId || !assigneeId) {
      // simple validation
      return;
    }

    await createTask.mutateAsync({ data: { matterId, title: form.title, description: form.description || null, priority: form.priority, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null, assigneeId } } as any);
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setTaskModalOpen(false);
  }

  async function loadHistory(taskId: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/history`);
      if (!res.ok) {
        setHistoryData([]);
      } else {
        const json = await res.json();
        setHistoryData(json.history || []);
      }
    } catch (err) {
      setHistoryData([]);
    }
    setHistoryLoading(false);
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
        <div className="flex items-center gap-3">
          <Button onClick={openCreate} className="mr-2">Add Task</Button>
          <div className="flex items-center gap-2">
            <button className={`px-3 py-1 rounded ${viewMode==="list"?"bg-primary text-primary-foreground":"border"}`} onClick={() => setViewMode("list")}>List</button>
            <button className={`px-3 py-1 rounded ${viewMode==="calendar"?"bg-primary text-primary-foreground":"border"}`} onClick={() => setViewMode("calendar")}>Calendar</button>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <input type="date" className="px-3 py-2 border rounded-md" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.matterId || ""} onValueChange={(v) => setForm({ ...form, matterId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(listMatters.data) ? listMatters.data : (listMatters.data as any)?.matters || []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.reference} — {m.debtorName || m.unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.assigneeId || ""} onValueChange={(v) => setForm({ ...form, assigneeId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(usersData) ? usersData : (usersData as any)?.users || []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              {editingTask && (
                <Button variant="outline" onClick={async () => { if (editingTask) { await loadHistory(editingTask.id); setHistoryOpen(true); } }}>View History</Button>
              )}
              <Button variant="outline" onClick={() => setTaskModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingTask ? "Save" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task History</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-auto">
            {historyLoading ? (
              <div className="text-center py-8">Loading…</div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No history</div>
            ) : (
              historyData.map((h) => (
                <div key={h.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <div>{h.action} by {h.userName || h.userId || 'System'}</div>
                    <div>{format(new Date(h.createdAt), 'dd MMM yyyy HH:mm')}</div>
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold">Old</div>
                    <pre className="whitespace-pre-wrap text-[12px] bg-gray-50 p-2 rounded">{JSON.stringify(h.oldData, null, 2)}</pre>
                    <div className="font-semibold mt-2">New</div>
                    <pre className="whitespace-pre-wrap text-[12px] bg-gray-50 p-2 rounded">{JSON.stringify(h.newData, null, 2)}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      

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
        viewMode === "list" ? (
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
                    <div className="flex items-center gap-2">
                      {statusFilter !== "ARCHIVED" && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(task)}>Edit</Button>
                      )}
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
                      {statusFilter === "ARCHIVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unarchiveTask(task.id)}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground"
                          onClick={() => archiveTask(task.id)}
                        >
                          <Archive className="h-4 w-4 mr-1" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Calendar view: simple month grid showing counts per day
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Next</Button>
              </div>
              <div className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} className="text-xs font-medium text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 mt-2">
              {
                // build month matrix
                (() => {
                  const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
                  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
                  const days: Date[] = [];
                  for (let d = start; d <= end; d = addDays(d, 1)) days.push(new Date(d));
                  const tasksByDay: Record<string, any[]> = {};
                  tasks.forEach((t: any) => {
                    if (!t.dueDate) return;
                    const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
                    tasksByDay[key] = tasksByDay[key] || [];
                    tasksByDay[key].push(t);
                  });

                  return days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const list = tasksByDay[key] ?? [];
                    return (
                      <div key={key} className={cn("border rounded-md p-2 h-24 overflow-hidden", day.getMonth() !== currentMonth.getMonth() ? 'bg-gray-50 text-muted-foreground' : '')}>
                        <div className="flex justify-between items-start text-xs mb-1">
                          <div>{format(day, 'd')}</div>
                          <div className="text-[10px] text-muted-foreground">{list.length}</div>
                        </div>
                        <div className="text-xs space-y-1 overflow-hidden">
                          {list.slice(0,3).map((t:any)=> (
                            <div key={t.id} className="truncate">{t.title}</div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()
              }
            </div>
          </div>
        )
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
