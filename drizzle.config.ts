import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env.local" });
config({ path: "env.local", override: false });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
