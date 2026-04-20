import { pool } from "./index.js";
import {
  usersTable,
  managingAgentsTable,
  schemesTable,
  debtorsTable,
  interestRatesTable,
} from "./schema/index.js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";

const db = drizzle(pool);

async function seed() {
  try {
    console.log("🌱 Starting database seed...");

    // Hash the default password
    const hashedPassword = await bcrypt.hash("Admin123!", 10);

    // Check if admin user exists
    const existingAdmin = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "admin@bamlaw.co.za"))
      .limit(1);

    if (existingAdmin.length === 0) {
      // Create default users
      await db.insert(usersTable).values([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "admin@bamlaw.co.za",
          name: "Admin User",
          passwordHash: hashedPassword,
          role: "ADMIN",
          isActive: true,
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          email: "attorney@bamlaw.co.za",
          name: "Attorney User",
          passwordHash: hashedPassword,
          role: "ATTORNEY",
          isActive: true,
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "collector@bamlaw.co.za",
          name: "Collector User",
          passwordHash: hashedPassword,
          role: "COLLECTOR",
          isActive: true,
        },
      ]);
      console.log("✅ Created default users");
    } else {
      console.log("⏭️  Admin user already exists, skipping user creation");
    }

    // Check if interest rates exist
    const existingRates = await db
      .select()
      .from(interestRatesTable)
      .limit(1);

    if (existingRates.length === 0) {
      // Create default interest rates (South African prescribed rate)
      // 11% p.a. stored as 0.11 (numeric precision 5,4)
      await db.insert(interestRatesTable).values({
        rate: "0.11",
        effectiveFrom: new Date("2024-01-01"),
        description: "South African prescribed rate",
      });
      console.log("✅ Created default interest rates");
    } else {
      console.log("⏭️  Interest rates already exist, skipping");
    }

    // Check if managing agents exist
    const existingAgents = await db.select().from(managingAgentsTable).limit(1);

    if (existingAgents.length === 0) {
      // Create sample managing agent
      await db.insert(managingAgentsTable).values({
        id: "550e8400-e29b-41d4-a716-446655440100",
        name: "BAM Law Attorneys",
        contactEmail: "info@bamlaw.co.za",
        contactPhone: "+27 11 123 4567",
        isActive: true,
      });
      console.log("✅ Created sample managing agent");
    } else {
      console.log("⏭️  Managing agents already exist, skipping");
    }

    console.log("🎉 Database seed completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
