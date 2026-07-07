import { useEffect } from "react";
import { io as socketIOClient } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { toastAutomationEvent, toastBotDraft } from "@/lib/automation-toasts";

interface UseAutomationSocketOptions {
  debtorId?: string;
  matterId?: string;
  onBotDraft?: (draft: { messageText: string; intent: string; debtorPhone: string; createdAt: string } | null) => void;
  onSettingsChange?: (settings: { automationEnabled: boolean; botAutoReplyEnabled: boolean }) => void;
  onRefresh?: () => void;
}

export function useAutomationSocket({
  debtorId,
  matterId,
  onBotDraft,
  onSettingsChange,
  onRefresh,
}: UseAutomationSocketOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!debtorId) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = socketIOClient(undefined, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { token },
    });

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["matter", matterId] });
      queryClient.invalidateQueries({ queryKey: [`/api/debtors/${debtorId}`] });
      onRefresh?.();
    };

    socket.on("connect", () => socket.emit("joinDebtor", debtorId));

    socket.on("debtor_activity", (payload: any) => {
      toastAutomationEvent(toast, {
        eventType: payload?.eventType,
        message: payload?.message ?? payload?.communication?.body,
        status: payload?.status,
      });
      refresh();
    });

    socket.on("bot_draft", (payload: any) => {
      if (matterId && payload?.matterId && payload.matterId !== matterId) return;
      const draft = payload?.draft ?? null;
      toastBotDraft(toast, draft);
      onBotDraft?.(draft);
      refresh();
    });

    socket.on("bot_typing", (payload: any) => {
      if (matterId && payload?.matterId && payload.matterId !== matterId) return;
      toast({ title: "Bot is generating a reply", description: payload?.message ?? "Automated reply is being prepared" });
      refresh();
    });

    socket.on("job_queued", (payload: any) => {
      if (matterId && payload?.matterId && payload.matterId !== matterId) return;
      toast({ title: "Job queued", description: payload?.label ? `${payload.label} queued` : "A workflow job has been queued" });
      refresh();
    });

    socket.on("job_started", (payload: any) => {
      if (matterId && payload?.matterId && payload.matterId !== matterId) return;
      toast({ title: "Job started", description: payload?.label ? `${payload.label} started` : "A workflow job has started" });
      refresh();
    });

    socket.on("automation_settings", (payload: any) => {
      if (matterId && payload?.matterId && payload.matterId !== matterId) return;
      onSettingsChange?.({
        automationEnabled: payload.automationEnabled,
        botAutoReplyEnabled: payload.botAutoReplyEnabled,
      });
    });

    socket.on("whatsapp_outbound", (payload: any) => {
      const status = payload?.status ?? payload?.whatsappMessage?.status;
      if (status === "SENT") {
        toast({ title: "Message sent", description: "WhatsApp message delivered to queue" });
      }
      refresh();
    });

    socket.on("whatsapp_inbound", (payload: any) => {
      const content = payload?.whatsappMessage?.content ?? payload?.communication?.body ?? "New message";
      toast({ title: "Reply received", description: content });
      refresh();
    });

    socket.on("document_generated", (payload: any) => {
      const docType = payload?.documentType ?? "Document";
      toast({ title: "Document ready", description: `${docType} generated` });
      refresh();
    });

    socket.on("communication_sent", refresh);
    socket.on("document_sent", () => {
      toast({ title: "LOD sent", description: "Document dispatched via WhatsApp" });
      refresh();
    });

    return () => {
      try {
        socket.emit("leaveDebtor", debtorId);
        socket.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [debtorId, matterId, toast, queryClient, onBotDraft, onSettingsChange, onRefresh]);
}
