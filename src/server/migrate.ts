import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run database migrations");
  }

  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./src/db/migrations" });
    console.info("Database migrations completed successfully");
  } finally {
    await pool.end();
  }
}

runMigrations().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error("Database migration failed", error);
    process.exit(1);
  },
);
