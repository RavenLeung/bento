import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/config";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  bentoPostgres?: ReturnType<typeof postgres>;
  bentoDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

export const sqlClient = env.DATABASE_URL
  ? (globalForDb.bentoPostgres ??=
      postgres(env.DATABASE_URL, {
        max: 5,
        prepare: false,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: env.DATABASE_URL.includes("sslmode=require") ? "require" : false
      }))
  : null;

export const db = sqlClient
  ? (globalForDb.bentoDrizzle ??= drizzle(sqlClient, { schema }))
  : null;

export function requireDb() {
  if (!sqlClient) {
    throw new Error("DATABASE_URL is required for this operation.");
  }
  return sqlClient;
}
