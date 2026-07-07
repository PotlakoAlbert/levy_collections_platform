import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from the lib/db directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

// NOW import the rest after dotenv is loaded
const { drizzle } = await import("drizzle-orm/node-postgres");
const { pool } = await import("./index.js");

const db = drizzle(pool);

async function reset() {
  try {
    console.log("🗑️  Starting database reset...");

    // Delete all data in reverse order of dependency (respecting foreign keys)
    const tables = [
      "whatsapp_messages",
      "bot_states",
      "matter_assignees",
      "auto_advance_rules",
      "communications",
      "payment_requisitions",
      "transactions",
      "postings",
      "ptps",
      "tasks",
      "history",
      "payments",
      "documents",
      "matters",
      "debtors",
      "schemes",
      "creditors",
      "managing_agents",
      "interest_rates",
      "users",
      "enhancements",
    ];

    for (const table of tables) {
      try {
        await db.execute(`TRUNCATE TABLE "${table}" CASCADE`);
        console.log(`✅ Cleared ${table}`);
      } catch (err: any) {
        // Table might not exist, skip it
        if (!err.message.includes("does not exist")) {
          console.warn(`⚠️  Error clearing ${table}:`, err.message);
        }
      }
    }

    console.log("🎉 Database reset completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  }
}

reset();
