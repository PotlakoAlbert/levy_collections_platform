import { Job } from "bullmq";
import { db, mattersTable, paymentsTable, stageHistoryTable, communicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { enqueueJob } from "./dispatcher";

/**
 * Payment worker job
 * Allocates payments and updates matter status
 */
export async function handlePaymentJob(job: Job) {
  logger.info({ ...job.data }, `[PAYMENT WORKER] Processing payment allocation`);

  try {
    const { paymentId, matterId } = job.data;

    if (!paymentId || !matterId) {
      logger.warn({ ...job.data }, `[PAYMENT WORKER] Missing required fields`);
      return { success: false, error: "paymentId and matterId required" };
    }

    // Get payment details
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId));

    if (!payment) {
      logger.warn({ paymentId }, `[PAYMENT WORKER] Payment not found`);
      return { success: false, error: "payment not found", paymentId };
    }

    // Get matter details
    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, matterId));

    if (!matter) {
      logger.warn({ matterId }, `[PAYMENT WORKER] Matter not found`);
      return { success: false, error: "matter not found", matterId };
    }

    // Allocate payment: capital > costs > interest
    const paymentAmount = parseFloat(payment.amount);
    const capital = parseFloat(matter.capitalArrears);
    const costs = parseFloat(matter.legalCosts);
    const interest = parseFloat(matter.interest);

    let remainingPayment = paymentAmount;
    let capitalAllocated = 0;
    let costsAllocated = 0;
    let interestAllocated = 0;

    // Allocate to capital first
    if (remainingPayment > 0 && capital > 0) {
      capitalAllocated = Math.min(remainingPayment, capital);
      remainingPayment -= capitalAllocated;
    }

    // Allocate to costs
    if (remainingPayment > 0 && costs > 0) {
      costsAllocated = Math.min(remainingPayment, costs);
      remainingPayment -= costsAllocated;
    }

    // Allocate to interest
    if (remainingPayment > 0 && interest > 0) {
      interestAllocated = Math.min(remainingPayment, interest);
      remainingPayment -= interestAllocated;
    }

    // Update matter with allocations
    const newCapital = capital - capitalAllocated;
    const newCosts = costs - costsAllocated;
    const newInterest = interest - interestAllocated;
    const newTotalPaid = parseFloat(matter.totalPaid) + paymentAmount;

    // Check if settled
    const isSettled = newCapital <= 0 && newCosts <= 0 && newInterest <= 0;
    // Mark fully settled matters as CLOSED_SETTLED so we can distinguish
    // between settled closures and written-off closures.
    const newStatus = isSettled ? "CLOSED_SETTLED" : matter.status;
    const newStage = isSettled ? "CLOSED" : matter.stage;

    await db
      .update(mattersTable)
      .set({
        capitalArrears: Math.max(0, newCapital).toString(),
        legalCosts: Math.max(0, newCosts).toString(),
        interest: Math.max(0, newInterest).toString(),
        totalPaid: newTotalPaid.toString(),
        status: newStatus,
        stage: newStage,
        updatedAt: new Date(),
      })
      .where(eq(mattersTable.id, matterId));

    // Log in history if stage changed
    if (newStage !== matter.stage) {
      await db.insert(stageHistoryTable).values({
        matterId,
        fromStage: matter.stage,
        toStage: newStage,
        notes: `Settlement payment of R${paymentAmount.toFixed(2)} received`,
        changedById: "system",
      });
    }

    // Log communication
    await db.insert(communicationsTable).values({
      matterId,
      to: "system@internal.local",
      channel: "SYSTEM",
      body: `Payment of R${paymentAmount.toFixed(2)} received and allocated`,
      status: "COMPLETED",
      createdById: "system",
    });

    logger.info({
      matterId,
      reference: matter.reference,
      paymentAmount: paymentAmount.toFixed(2),
      capitalAllocated: capitalAllocated.toFixed(2),
      costsAllocated: costsAllocated.toFixed(2),
      interestAllocated: interestAllocated.toFixed(2),
      isSettled,
      newStatus,
    }, `[PAYMENT WORKER] Payment processed`);

    return {
      success: true,
      paymentId,
      matterId,
      reference: matter.reference,
      paymentAmount: paymentAmount.toFixed(2),
      capitalAllocated: capitalAllocated.toFixed(2),
      isSettled,
      newStatus,
    };
  } catch (error) {
    logger.error({ err: error }, `[PAYMENT WORKER] Error processing payment`);
    throw error;
  }
}
