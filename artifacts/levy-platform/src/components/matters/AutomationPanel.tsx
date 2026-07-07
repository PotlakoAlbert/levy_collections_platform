import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGenerateDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";
import { useAutomationSocket } from "@/hooks/useAutomationSocket";
import { toastWhatsAppQueued } from "@/lib/automation-toasts";
import { Bot, FileText, Loader2, Send, Zap } from "lucide-react";

interface PendingDraft {
  messageText: string;
  intent: string;
  debtorPhone: string;
  createdAt: string;
}

interface AutomationPanelProps {
  matterId: string;
  debtorId: string;
  matterReference: string;
  debtorName: string;
  debtorPhone?: string;
}

export function AutomationPanel({
  matterId,
  debtorId,
  matterReference,
  debtorName,
  debtorPhone,
}: AutomationPanelProps) {
  const { toast } = useToast();
  const generateDoc = useGenerateDocument();

  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [botAutoReplyEnabled, setBotAutoReplyEnabled] = useState(true);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [draftEditText, setDraftEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lodDialogOpen, setLodDialogOpen] = useState(false);
  const [lodMessage, setLodMessage] = useState("");
  const [lodSending, setLodSending] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await customFetch<{
        automationEnabled: boolean;
        botAutoReplyEnabled: boolean;
        pendingDraft: PendingDraft | null;
      }>(`/api/matters/${matterId}/automation`, { method: "GET" });
      setAutomationEnabled(data.automationEnabled);
      setBotAutoReplyEnabled(data.botAutoReplyEnabled);
      setPendingDraft(data.pendingDraft);
      if (data.pendingDraft) setDraftEditText(data.pendingDraft.messageText);
    } catch {
      /* defaults */
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useAutomationSocket({
    debtorId,
    matterId,
    onBotDraft: (draft) => {
      setPendingDraft(draft);
      if (draft?.messageText) setDraftEditText(draft.messageText);
      else setDraftEditText("");
    },
    onSettingsChange: (s) => {
      setAutomationEnabled(s.automationEnabled);
      setBotAutoReplyEnabled(s.botAutoReplyEnabled);
    },
    onRefresh: () => {
      window.dispatchEvent(new CustomEvent("communications-refresh", { detail: { matterId } }));
    },
  });

  async function patchSettings(updates: Partial<{ automationEnabled: boolean; botAutoReplyEnabled: boolean }>) {
    setSaving(true);
    try {
      const data = await customFetch<{
        automationEnabled: boolean;
        botAutoReplyEnabled: boolean;
        pendingDraft: PendingDraft | null;
      }>(`/api/matters/${matterId}/automation`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      setAutomationEnabled(data.automationEnabled);
      setBotAutoReplyEnabled(data.botAutoReplyEnabled);
      toast({
        title: "Automation updated",
        description: updates.automationEnabled !== undefined
          ? updates.automationEnabled ? "Automation enabled" : "Automation paused"
          : updates.botAutoReplyEnabled
            ? "Bot will auto-send replies"
            : "Bot will draft replies for your review",
      });
    } catch {
      toast({ title: "Error", description: "Failed to update automation settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveDraft() {
    if (!pendingDraft) return;
    setSaving(true);
    try {
      toastWhatsAppQueued(toast, "Approved bot reply");
      await customFetch(`/api/matters/${matterId}/bot-draft/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: draftEditText }),
      });
      setPendingDraft(null);
      setDraftEditText("");
      toast({ title: "Bot message sent", description: "Approved draft queued for delivery" });
    } catch {
      toast({ title: "Error", description: "Failed to send bot draft", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectDraft() {
    try {
      await customFetch(`/api/matters/${matterId}/bot-draft/reject`, { method: "POST" });
      setPendingDraft(null);
      setDraftEditText("");
      toast({ title: "Draft discarded" });
    } catch {
      toast({ title: "Error", description: "Failed to discard draft", variant: "destructive" });
    }
  }

  async function openLodPreview() {
    if (!debtorPhone) {
      toast({ title: "No phone", description: "Debtor has no WhatsApp number", variant: "destructive" });
      return;
    }
    setLodSending(true);
    try {
      const doc = await generateDoc.mutateAsync({ data: { matterId, docType: "LOD" } });
      setGeneratedDocId(doc.id);
      setLodMessage(
        `Dear ${debtorName},\n\nPlease find your Letter of Demand for matter ${matterReference}. Contact us urgently to discuss settlement.\n\n${doc.fileUrl ?? ""}`
      );
      setLodDialogOpen(true);
    } catch {
      toast({ title: "Error", description: "Failed to generate LOD", variant: "destructive" });
    } finally {
      setLodSending(false);
    }
  }

  async function handleSendLod() {
    if (!generatedDocId) return;
    setLodSending(true);
    try {
      toast({ title: "Sending LOD", description: "LOD via WhatsApp — queued next in queue" });
      await customFetch(`/api/documents/${generatedDocId}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channels: ["WHATSAPP"],
          message: lodMessage,
        }),
      });
      setLodDialogOpen(false);
      toast({ title: "LOD queued", description: "Letter of Demand queued for WhatsApp delivery" });
    } catch {
      toast({ title: "Error", description: "Failed to send LOD", variant: "destructive" });
    } finally {
      setLodSending(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="automation-enabled" className="text-sm font-medium">Automation enabled</Label>
              <p className="text-xs text-muted-foreground">Auto-generate LOD, reminders, and queue notifications</p>
            </div>
            <Switch
              id="automation-enabled"
              checked={automationEnabled}
              disabled={saving}
              onCheckedChange={(v) => {
                setAutomationEnabled(v);
                patchSettings({ automationEnabled: v });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" /> Bot auto-reply
            </Label>
            <p className="text-xs text-muted-foreground">
              {botAutoReplyEnabled
                ? "🚀 Bot sends replies automatically (instant)"
                : "👁️ Bot drafts replies — you review before sending"}
            </p>
            <Button
              onClick={() => {
                const newValue = !botAutoReplyEnabled;
                setBotAutoReplyEnabled(newValue);
                patchSettings({ botAutoReplyEnabled: newValue });
              }}
              disabled={saving}
              variant={botAutoReplyEnabled ? "default" : "outline"}
              className={`w-full font-semibold transition-all ${
                botAutoReplyEnabled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-blue-300 text-blue-700 hover:bg-blue-50"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : botAutoReplyEnabled ? (
                <>
                  ✓ Auto-Reply Enabled
                </>
              ) : (
                <>
                  ○ Auto-Reply Disabled (Draft Mode)
                </>
              )}
            </Button>
          </div>

          {pendingDraft && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-amber-900">Bot draft — review before sending</p>
                <Badge variant="outline" className="text-xs">{pendingDraft.intent}</Badge>
              </div>
              <Textarea
                value={draftEditText}
                onChange={(e) => setDraftEditText(e.target.value)}
                className="min-h-[80px] text-sm bg-white"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleApproveDraft} disabled={saving || !draftEditText.trim()}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
                <Button size="sm" variant="outline" onClick={handleRejectDraft} disabled={saving}>
                  Discard
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={openLodPreview}
            disabled={lodSending || !debtorPhone}
          >
            {lodSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Send LOD via WhatsApp
          </Button>
        </CardContent>
      </Card>

      <Dialog open={lodDialogOpen} onOpenChange={setLodDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview LOD WhatsApp message</DialogTitle>
            <DialogDescription>
              Review the message before sending to {debtorName}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={lodMessage}
            onChange={(e) => setLodMessage(e.target.value)}
            className="min-h-[140px] text-sm"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLodDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendLod} disabled={lodSending || !lodMessage.trim()}>
              {lodSending ? "Queuing..." : "Send via WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
