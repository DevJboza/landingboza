import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: "env.local", override: false });
import { getDb } from "../db/index";
import { agentSettings } from "../db/schema";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is not configured");
const db = getDb();
await db
  .insert(agentSettings)
  .values({
    id: "default",
    sessionTimeoutMinutes: 10,
    reminderMinutes: 7,
    autoReply: true,
    aiFallback: true,
    outOfHoursEnabled: false,
    agentEnabled: true,
  })
  .onConflictDoNothing();
console.log(
  "Agent settings seed completed. No demo customer data was inserted.",
);
process.exit(0);
