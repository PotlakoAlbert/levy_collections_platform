import { db, matterCountersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function generateMatterReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = "BAM";

  // Upsert counter
  const existing = await db.select().from(matterCountersTable).where(eq(matterCountersTable.year, year));

  let count: number;
  if (existing.length === 0) {
    const [inserted] = await db.insert(matterCountersTable).values({ year, count: 1 }).returning();
    count = inserted.count;
  } else {
    const [updated] = await db
      .update(matterCountersTable)
      .set({ count: existing[0].count + 1 })
      .where(eq(matterCountersTable.year, year))
      .returning();
    count = updated.count;
  }

  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}
