import { Job } from "bullmq";
import { db, mattersTable, paymentsTable, communicationsTable } from "@workspace/db";
import { eq, gte, lte, and } from "drizzle-orm";
import { logger } from "../logger";

/**
 * Report generation worker job
 * Generates aggregated reports on collections and matters
 */
export async function handleReportJob(job: Job) {
  logger.info({ ...job.data }, `[REPORT WORKER] Processing report generation`);

  try {
    const { reportType, period } = job.data;

    if (!reportType) {
      logger.warn(`[REPORT WORKER] No reportType provided`);
      return { success: false, error: "reportType required" };
    }

    // Calculate date range for report
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let reportData: any = {
      reportType,
      generatedAt: now.toISOString(),
    };

    switch (reportType) {
      case "WEEKLY":
        reportData = await generateWeeklyReport(oneWeekAgo, now, reportData);
        break;
      case "MONTHLY":
        reportData = await generateMonthlyReport(oneMonthAgo, now, reportData);
        break;
      case "SUMMARY":
        reportData = await generateSummaryReport(reportData);
        break;
      default:
        logger.warn(`[REPORT WORKER] Unknown report type: ${reportType}`);
        return { success: false, error: `unknown report type: ${reportType}` };
    }

    logger.info({
      reportType,
      stats: reportData,
    }, `[REPORT WORKER] Report generated`);

    return {
      success: true,
      reportType,
      data: reportData,
    };
  } catch (error) {
    logger.error({ err: error }, `[REPORT WORKER] Error generating report`);
    throw error;
  }
}

async function generateWeeklyReport(from: Date, to: Date, base: any) {
  // Get all matters with updates this week
  const matters = await db
    .select()
    .from(mattersTable)
    .where(and(
      gte(mattersTable.updatedAt, from),
      lte(mattersTable.updatedAt, to),
    ));

  // Get payments received this week
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(and(
      gte(paymentsTable.createdAt, from),
      lte(paymentsTable.createdAt, to),
    ));

  const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  // Count matters that advanced stages during the period (would require stageHistoryTable)
  // For now, count matters that changed stage based on updatedAt
  const mattersAdvanced = matters.filter(m => m.s129Date && new Date(m.s129Date) >= from && new Date(m.s129Date) <= to).length;

  return {
    ...base,
    period: "WEEKLY",
    from: from.toISOString(),
    to: to.toISOString(),
    mattersProcessed: matters.length,
    mattersAdvanced,
    paymentsReceived: payments.length,
    totalPaymentsValue: totalPayments.toFixed(2),
    averagePayment: payments.length > 0 ? (totalPayments / payments.length).toFixed(2) : "0.00",
  };
}

async function generateMonthlyReport(from: Date, to: Date, base: any) {
  // Get all active matters
  const activeMatters = await db
    .select()
    .from(mattersTable)
    .where(and(
      eq(mattersTable.status, "ACTIVE"),
      gte(mattersTable.createdAt, from),
    ));

  // Get matters updated in range and count closed/settled statuses
  const closedCandidates = await db
    .select()
    .from(mattersTable)
    .where(and(
      gte(mattersTable.updatedAt, from),
      lte(mattersTable.updatedAt, to),
    ));
  const closedMatters = closedCandidates.filter(m => m.status === "PAID_IN_FULL" || String(m.status).startsWith("CLOSED"));

  // Get all payments
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(and(
      gte(paymentsTable.createdAt, from),
      lte(paymentsTable.createdAt, to),
    ));

  const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalInterest = activeMatters.reduce((sum, m) => sum + parseFloat(m.interest), 0);

  // Calculate closure rate with zero guard
  const closureRate = activeMatters.length > 0
    ? ((closedMatters.length / activeMatters.length) * 100).toFixed(2) + "%"
    : "N/A";

  return {
    ...base,
    period: "MONTHLY",
    from: from.toISOString(),
    to: to.toISOString(),
    activeMatters: activeMatters.length,
    closedMatters: closedMatters.length,
    paymentsReceived: payments.length,
    totalPaymentsValue: totalPayments.toFixed(2),
    totalInterestCollected: totalInterest.toFixed(2),
    closureRate,
  };
}

async function generateSummaryReport(base: any) {
  // Overall statistics
  const allMatters = await db.select().from(mattersTable);
  const activeMatters = allMatters.filter(m => m.status === "ACTIVE");
  const settledMatters = allMatters.filter(m => m.status === "PAID_IN_FULL" || String(m.status).startsWith("CLOSED"));

  const totalCapital = allMatters.reduce((sum, m) => sum + parseFloat(m.capitalArrears), 0);
  const totalInterest = allMatters.reduce((sum, m) => sum + parseFloat(m.interest), 0);
  const totalPaid = allMatters.reduce((sum, m) => sum + parseFloat(m.totalPaid), 0);

  return {
    ...base,
    period: "SUMMARY",
    totalMatters: allMatters.length,
    activeMatters: activeMatters.length,
    settledMatters: settledMatters.length,
    totalOutstandingCapital: totalCapital.toFixed(2),
    totalOutstandingInterest: totalInterest.toFixed(2),
    totalPaidToDate: totalPaid.toFixed(2),
    settlementRate:
      allMatters.length > 0
        ? ((settledMatters.length / allMatters.length) * 100).toFixed(2) + "%"
        : "0.00%",
  };
}
