import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "R 0.00";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount).replace("ZAR", "R");
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export const STAGE_COLORS: Record<string, string> = {
  LOD: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  S129: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  SUMMONS: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  JUDGMENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  WRIT: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  RULE46: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  SALE: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300",
  CLOSED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

/** Hex colour values for inline CSS use (charts, kanban borders, etc.) */
export const STAGE_HEX_COLORS: Record<string, string> = {
  LOD: "#3b82f6",
  S129: "#eab308",
  SUMMONS: "#f97316",
  JUDGMENT: "#ef4444",
  WRIT: "#a855f7",
  RULE46: "#6366f1",
  SALE: "#f43f5e",
  CLOSED: "#6b7280",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

/** Hex colour values for inline CSS use (kanban badges, etc.) */
export const PRIORITY_HEX_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};
