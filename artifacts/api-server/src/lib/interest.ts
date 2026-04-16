import { db, interestRatesTable } from "@workspace/db";
import { lte, or, isNull } from "drizzle-orm";

export async function calculateInterest(
  principal: number,
  fromDate: Date,
  toDate: Date = new Date(),
  overrideRate?: number
): Promise<{ interest: number; rate: number; days: number; perDay: number }> {
  if (fromDate >= toDate) {
    return { interest: 0, rate: overrideRate ?? 0, days: 0, perDay: 0 };
  }

  let totalInterest = 0;
  let currentDate = new Date(fromDate);
  let finalRate = overrideRate ?? 0;

  if (overrideRate != null) {
    const days = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const perDay = (principal * overrideRate) / 365;
    return { interest: perDay * days, rate: overrideRate, days, perDay };
  }

  // Get all rate periods
  const rates = await db.select().from(interestRatesTable).orderBy(interestRatesTable.effectiveFrom);

  if (rates.length === 0) {
    // Default South African prescribed rate 10.75%
    const defaultRate = 0.1075;
    const days = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const perDay = (principal * defaultRate) / 365;
    return { interest: perDay * days, rate: defaultRate, days, perDay };
  }

  // Multi-period interest calculation
  let totalDays = 0;
  for (const rate of rates) {
    const rateStart = new Date(rate.effectiveFrom);
    const rateEnd = rate.effectiveTo ? new Date(rate.effectiveTo) : new Date("9999-12-31");
    const periodStart = currentDate > rateStart ? currentDate : rateStart;
    const periodEnd = toDate < rateEnd ? toDate : rateEnd;

    if (periodStart >= toDate) break;
    if (periodEnd <= fromDate) continue;
    if (periodStart >= periodEnd) continue;

    const days = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const rateValue = parseFloat(rate.rate);
    totalInterest += (principal * rateValue * days) / 365;
    totalDays += days;
    finalRate = rateValue;
    currentDate = periodEnd;
  }

  const days = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  const perDay = days > 0 ? totalInterest / days : 0;
  return { interest: totalInterest, rate: finalRate, days, perDay };
}

export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let count = 0;
  while (count < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return result;
}
