type ToastFn = (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

const EVENT_TOASTS: Record<string, { title: string; variant?: "destructive" }> = {
  MATTER_AUTOMATION_STARTED: { title: "Automation started" },
  LOD_GENERATING: { title: "Generating LOD" },
  LOD_GENERATED: { title: "LOD ready" },
  LOD_SENDING: { title: "Sending LOD via WhatsApp" },
  JOB_QUEUED: { title: "Queued" },
  BOT_REPLY_QUEUED: { title: "Bot drafting reply" },
  BOT_DRAFT_READY: { title: "Bot draft ready — review before sending" },
  WHATSAPP_SENDING: { title: "Sending WhatsApp message" },
  WHATSAPP_SENT: { title: "Message sent" },
  WHATSAPP_FAILED: { title: "WhatsApp failed", variant: "destructive" },
  BOT_ESCALATED: { title: "Escalated for review" },
  REMINDER_SCHEDULED: { title: "Reminder scheduled" },
  REMINDER_SENDING: { title: "Sending reminder" },
  STAGE_CHANGED: { title: "Stage updated" },
};

export function toastAutomationEvent(
  toast: ToastFn,
  payload: { eventType?: string; message?: string; status?: string }
) {
  const message = payload?.message ?? "Automation update";
  const eventType = payload?.eventType ?? "";
  const meta = EVENT_TOASTS[eventType];

  if (meta) {
    toast({
      title: meta.title,
      description: message,
      variant: meta.variant,
    });
    return;
  }

  toast({ title: "Automation", description: message });
}

export function toastBotDraft(
  toast: ToastFn,
  draft: { messageText?: string; intent?: string } | null
) {
  if (!draft?.messageText) return;
  const preview = draft.messageText.length > 100
    ? `${draft.messageText.slice(0, 100)}...`
    : draft.messageText;
  toast({
    title: "Bot drafted a message",
    description: preview,
  });
}

export function toastWhatsAppQueued(toast: ToastFn, label = "WhatsApp message") {
  toast({
    title: "Queued",
    description: `${label} — processing next in queue`,
  });
}
