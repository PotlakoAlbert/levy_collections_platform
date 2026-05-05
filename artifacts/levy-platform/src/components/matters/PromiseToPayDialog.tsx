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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, Calendar, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PromiseToPayDialogProps {
  matterId: string;
  debtorName: string;
  outstandingAmount: number;
  onSuccess?: () => void;
}

export function PromiseToPayDialog({
  matterId,
  debtorName,
  outstandingAmount,
  onSuccess,
}: PromiseToPayDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState("");
  const [installmentDay, setInstallmentDay] = useState("1");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [numberOfTerms, setNumberOfTerms] = useState("12");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!firstPaymentDate || !firstPaymentAmount || !installmentAmount) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Terms not accepted",
        description: "Please accept the terms to create the promise to pay",
        variant: "destructive",
      });
      return;
    }

    const firstAmount = parseFloat(firstPaymentAmount);
    const installAmount = parseFloat(installmentAmount);

    if (firstAmount <= 0 || installAmount <= 0) {
      toast({
        title: "Invalid amounts",
        description: "Amounts must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/matters/${matterId}/ptp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstPaymentDate,
          firstPaymentAmount: firstAmount,
          installmentDay: parseInt(installmentDay),
          installmentAmount: installAmount,
          numberOfTerms: parseInt(numberOfTerms),
          promiseDate: new Date().toISOString().split("T")[0],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create promise to pay");
      }

      toast({
        title: "Success",
        description: "Promise to Pay agreement created successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["matter", matterId] });
      setIsOpen(false);

      // Reset form
      setFirstPaymentDate("");
      setFirstPaymentAmount("");
      setInstallmentDay("1");
      setInstallmentAmount("");
      setNumberOfTerms("12");
      setTermsAccepted(false);

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create promise to pay",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTerms = parseInt(numberOfTerms) || 1;
  const installAmount = parseFloat(installmentAmount) || 0;
  const projectedTotal = parseFloat(firstPaymentAmount || "0") + installAmount * totalTerms;

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="w-full sm:w-auto">Create Promise To Pay</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[95vw] max-w-sm sm:max-w-md md:max-w-md mx-auto p-4 sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle>Create Promise To Pay Agreement</AlertDialogTitle>
          <AlertDialogDescription>
            Set up a payment arrangement with {debtorName}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 max-h-[80vh] overflow-y-auto">
          {/* Warning */}
          <div className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-amber-800">
              <p className="font-medium">Outstanding Amount</p>
              <p className="text-xs mt-1">{formatCurrency(outstandingAmount)}</p>
            </div>
          </div>

          {/* First Payment */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="firstPaymentDate" className="text-xs sm:text-sm font-medium">
              First Payment Date *
            </Label>
            <div className="flex gap-1.5 sm:gap-2">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mt-2 shrink-0" />
              <Input
                id="firstPaymentDate"
                type="date"
                value={firstPaymentDate}
                onChange={(e) => setFirstPaymentDate(e.target.value)}
                className="flex-1 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="firstPaymentAmount" className="text-xs sm:text-sm font-medium">
              First Payment Amount (R) *
            </Label>
            <div className="flex gap-1.5 sm:gap-2">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mt-2 shrink-0" />
              <Input
                id="firstPaymentAmount"
                type="number"
                placeholder="0.00"
                value={firstPaymentAmount}
                onChange={(e) => setFirstPaymentAmount(e.target.value)}
                className="flex-1 text-xs sm:text-sm"
                step="0.01"
              />
            </div>
          </div>

          {/* Installment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="installmentDay" className="text-xs sm:text-sm font-medium">
                Installment Day *
              </Label>
              <Input
                id="installmentDay"
                type="number"
                min="1"
                max="31"
                value={installmentDay}
                onChange={(e) => setInstallmentDay(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="installmentAmount" className="text-xs sm:text-sm font-medium">
                Installment Amount (R) *
              </Label>
              <Input
                id="installmentAmount"
                type="number"
                placeholder="0.00"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                step="0.01"
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="numberOfTerms" className="text-xs sm:text-sm font-medium">
              Number of Installments
            </Label>
            <Input
              id="numberOfTerms"
              type="number"
              min="1"
              max="60"
              value={numberOfTerms}
              onChange={(e) => setNumberOfTerms(e.target.value)}
              className="text-xs sm:text-sm"
            />
          </div>

          {/* Projection */}
          {projectedTotal > 0 && (
            <Card className="p-2 sm:p-3 bg-blue-50 border-blue-200">
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-900">Payment Summary</p>
                <div className="text-xs sm:text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-blue-700">First payment:</span>
                    <span className="font-medium text-blue-900">{formatCurrency(parseFloat(firstPaymentAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">{totalTerms} × installments:</span>
                    <span className="font-medium text-blue-900">{formatCurrency(installAmount * totalTerms)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-200">
                    <span className="font-medium text-blue-900">Total projected:</span>
                    <span className="font-bold text-blue-900">{formatCurrency(projectedTotal)}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Terms */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="termsAccepted"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 shrink-0"
            />
            <Label htmlFor="termsAccepted" className="text-xs text-muted-foreground cursor-pointer leading-snug">
              I confirm this payment arrangement has been negotiated and agreed to by the debtor. I will document all payments and initiate appropriate action if payments are not received as promised.
            </Label>
          </div>
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isSubmitting || !termsAccepted}
            className="gap-2 w-full sm:w-auto"
          >
            {isSubmitting ? "Creating..." : "Create Agreement"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
