import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ContactPage() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("http://localhost:8080/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err && err.error) || "Failed to submit");
      }

      setStatus("Thanks — we received your message.");
      setName("");
      setEmail("");
      setMessage("");
      // Navigate to home lightly after success
      setTimeout(() => setLocation("/"), 1000);
    } catch (err: any) {
      setStatus(err?.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Contact Sales / Request Demo</CardTitle>
            <CardDescription>Tell us a little about your organisation and we'll get back to you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.za" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" />
              </div>

              {status && <div className="text-sm text-muted-foreground">{status}</div>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isSubmitting} className="px-4 py-2">
                  {isSubmitting ? "Sending…" : "Send Message"}
                </Button>
                <Button variant="ghost" onClick={() => setLocation("/")}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ContactPage;
