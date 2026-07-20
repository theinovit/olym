import { randomUUID } from "node:crypto";

import { mockDomains } from "@/lib/mock-data";
import type { Domain } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { ConflictError, NotFoundError } from "../errors";
import { getApplication } from "./applications";
import { serializeDates } from "./mappers";

export async function listDomains(): Promise<Domain[]> {
  if (!isDatabaseEnabled()) return mockDomains;
  const rows = await getDb().select().from(schema.domains).orderBy(asc(schema.domains.createdAt));
  return rows.map((row) => serializeDates<Domain>(row));
}

export async function getDomain(id: string): Promise<Domain | null> {
  if (!isDatabaseEnabled()) {
    return mockDomains.find((domain) => domain.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.domains).where(eq(schema.domains.id, id)).limit(1);
  return row ? serializeDates<Domain>(row) : null;
}

export async function createDomain(input: {
  applicationId: string;
  hostname: string;
  isPrimary: boolean;
}): Promise<Domain> {
  if (!(await getApplication(input.applicationId))) {
    throw new NotFoundError(`Application not found: ${input.applicationId}`);
  }
  if (!isDatabaseEnabled()) {
    if (mockDomains.some((domain) => domain.hostname === input.hostname)) {
      throw new ConflictError(
        "DOMAIN_ALREADY_EXISTS",
        "This hostname is already configured.",
      );
    }
    if (input.isPrimary) {
      for (const domain of mockDomains) {
        if (domain.applicationId === input.applicationId) domain.isPrimary = false;
      }
    }
    const domain: Domain = {
      id: randomUUID(),
      ...input,
      sslStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    mockDomains.push(domain);
    return domain;
  }

  try {
    return await getDb().transaction(async (transaction) => {
      if (input.isPrimary) {
        await transaction
          .update(schema.domains)
          .set({ isPrimary: false })
          .where(eq(schema.domains.applicationId, input.applicationId));
      }
      const [row] = await transaction
        .insert(schema.domains)
        .values({ ...input, sslStatus: "pending" })
        .returning();
      return serializeDates<Domain>(row);
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConflictError(
        "DOMAIN_ALREADY_EXISTS",
        "This hostname is already configured.",
      );
    }
    throw error;
  }
}
