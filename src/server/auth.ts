import { compare, hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { ConflictError } from "./errors";

const BCRYPT_ROUNDS = 12;

export interface AuthenticatedUser {
  id: string;
  email: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hasAdminAccount(): Promise<boolean> {
  const rows = await getDb()
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(1);
  return rows.length > 0;
}

export async function setupAdminAccount(
  email: string,
  password: string,
  instanceName: string,
): Promise<AuthenticatedUser> {
  const passwordHash = await hash(password, BCRYPT_ROUNDS);
  return getDb().transaction(async (transaction) => {
    // Serialize setup attempts across all Olym instances/processes.
    await transaction.execute(sql`select pg_advisory_xact_lock(68431517)`);
    const existing = await transaction
      .select({ id: schema.users.id })
      .from(schema.users)
      .limit(1);
    if (existing.length) {
      throw new ConflictError(
        "ACCOUNT_ALREADY_CONFIGURED",
        "The administrator account has already been configured.",
      );
    }
    const [user] = await transaction
      .insert(schema.users)
      .values({ email: normalizeEmail(email), passwordHash })
      .returning({ id: schema.users.id, email: schema.users.email });
    await transaction.insert(schema.instanceSettings).values({
      id: 1,
      name: instanceName.trim(),
    });
    return user;
  });
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await getDb()
    .select({
      id: schema.users.id,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.email, normalizeEmail(email)))
    .limit(1);
  if (!user || !(await compare(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email };
}

export async function getUserById(
  id: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await getDb()
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return user ?? null;
}
