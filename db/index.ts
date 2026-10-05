import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
  if (!client)
    client = postgres(connectionString(), {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 8,
      max_lifetime: 60,
      ssl: "require",
    });
  if (!database) database = drizzle(client, { schema });
  return database;
}
export async function checkDatabase() {
  const client = postgres(connectionString(), {
    prepare: false,
    max: 1,
    connect_timeout: 8,
    ssl: "require",
  });
  try {
    await client`select 1`;
    return true;
  } finally {
    await client.end();
  }
}
