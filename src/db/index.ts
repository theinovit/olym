// Lazy Drizzle client — the pool is only created on first use, so
// `next build` succeeds without a running database or DATABASE_URL.

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
      );
    }
    db = drizzle(new Pool({ connectionString }), { schema });
  }
  return db;
}

export { schema };
