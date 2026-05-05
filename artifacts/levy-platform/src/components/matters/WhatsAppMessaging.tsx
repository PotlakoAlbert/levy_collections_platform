import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { MessageCircle, Send, AlertCircle, CheckCircle2, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface WhatsAppMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content?: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  createdAt: string;
}

interface WhatsAppMessagingProps {
  matterId: string;
  debtorName: string;
  debtorPhone?: string;
  messages?: WhatsAppMessage[];
}

export function WhatsAppMessaging({
  matterId,
  debtorName,
  debtorPhone,
  messages = [],
}: WhatsAppMessagingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [customPhone, setCustomPhone] = useState(debtorPhone || "");

  if (!debtorPhone && !customPhone) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">No WhatsApp number on file for this debtor</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSendMessage = async () => {
    if (!messageContent.trim()) {
      toast({
        title: "Empty message",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);

      const response = await fetch(`/api/matters/${matterId}/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messageContent,
          recipientPhone: customPhone || debtorPhone,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      toast({
        title: "Success",
        description: "Message sent successfully",
      });

      setMessageContent("");
      queryClient.invalidateQueries({ queryKey: ["matter", matterId] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "DELIVERED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "READ":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "FAILED":
        return <X className="h-4 w-4 text-red-500" />;
      case "QUEUED":
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-blue-50 border-blue-200";
      case "DELIVERED":
        return "bg-green-50 border-green-200";
      case "READ":
        return "bg-green-100 border-green-300";
      case "FAILED":
        return "bg-red-50 border-red-200";
      case "QUEUED":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-gray-50";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp Messages</span>
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 w-full sm:w-auto">
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-sm sm:max-w-md mx-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Send WhatsApp Message</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Send a message to {debtorName} via WhatsApp
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="phone" className="text-xs sm:text-sm font-medium">
                    Recipient Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="27821234567"
                    className="text-xs sm:text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (27 for South Africa)
                  </p>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="message" className="text-xs sm:text-sm font-medium">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    className="min-h-[100px] text-xs sm:text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {messageContent.length} characters
                  </p>
                </div>

                {/* Quick Templates */}
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Quick Templates</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs sm:text-sm"
                      onClick={() =>
                        setMessageContent(
                          `Hi ${debtorName}, we have an outstanding account balance that requires immediate payment. Please contact us to settle or arrange payment. Thank you.`
                        )
                      }
                    >
                      Payment Reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs sm:text-sm"
                      onClick={() =>
                        setMessageContent(
                          `Hi ${debtorName}, we would like to discuss a payment arrangement for your outstanding balance. Please let us know your availability to discuss.`
                        )
                      }
                    >
                      Arrangement Offer
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleSendMessage} disabled={isSending} className="w-full sm:w-auto">
                  {isSending ? "Sending..." : "Send Message"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">No messages sent yet</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("p-2 sm:p-3 rounded-lg border text-xs sm:text-sm", getStatusColor(msg.status))}
              >
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-xs"
                  >
                    {msg.direction === "OUTBOUND" ? "Sent" : "Received"}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(msg.status)}
                    <span className="text-xs text-muted-foreground capitalize">
                      {msg.status.toLowerCase()}
                    </span>
                  </div>
                </div>
                {msg.content && <p className="text-xs sm:text-sm mb-2">{msg.content}</p>}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(msg.createdAt), "dd MMM yyyy HH:mm")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
