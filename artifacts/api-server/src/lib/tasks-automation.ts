import { db, tasksTable } from "@workspace/db";
import { addBusinessDays } from "./interest";

const STAGE_TASKS: Record<string, Array<{ title: string; description: string; dueDays: number; priority: string }>> = {
  LOD: [
    { title: "Await LOD response", description: "Wait for debtor to respond to Letter of Demand", dueDays: 10, priority: "HIGH" },
    { title: "Send LOD via registered post", description: "Ensure LOD is sent via registered post and WhatsApp", dueDays: 1, priority: "URGENT" },
  ],
  S129: [
    { title: "Await S129 response", description: "Wait 10 business days for response to Section 129 Notice", dueDays: 10, priority: "HIGH" },
  ],
  SUMMONS: [
    { title: "Issue summons", description: "Prepare and issue combined summons", dueDays: 5, priority: "HIGH" },
    { title: "Effect service of summons", description: "Ensure sheriff effects service", dueDays: 14, priority: "HIGH" },
  ],
  JUDGMENT: [
    { title: "Apply for default judgment", description: "Apply for default judgment in court", dueDays: 5, priority: "URGENT" },
  ],
  WRIT: [
    { title: "Issue writ of execution", description: "Prepare writ of execution after judgment", dueDays: 7, priority: "HIGH" },
    { title: "Instruct sheriff", description: "Instruct sheriff to execute writ", dueDays: 3, priority: "URGENT" },
  ],
  RULE46: [
    { title: "Issue Rule 46 Notice", description: "Issue Rule 46(1) Notice for execution against immovable property", dueDays: 3, priority: "URGENT" },
  ],
  SALE: [
    { title: "Confirm sale date", description: "Confirm sale in execution date with sheriff", dueDays: 5, priority: "HIGH" },
  ],
};

export async function createAutoTasks(matterId: string, stage: string, assigneeId: string): Promise<void> {
  const stageTasks = STAGE_TASKS[stage];
  if (!stageTasks) return;

  const now = new Date();
  for (const taskDef of stageTasks) {
    const dueDate = addBusinessDays(now, taskDef.dueDays);
    await db.insert(tasksTable).values({
      matterId,
      title: taskDef.title,
      description: taskDef.description,
      status: "PENDING",
      priority: taskDef.priority,
      dueDate,
      assigneeId,
      isAutoGen: true,
    });
  }
}
