import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import type { EnvironmentName, EnvVar } from "@/lib/types";

import { isDatabaseEnabled } from "../env";
import { NotFoundError } from "../errors";
import { getApplication } from "./applications";

interface StoredEnvVar {
  id: string;
  applicationId: string;
  environment: EnvironmentName;
  key: string;
  value: string;
  createdAt: Date;
}

const simulatedEnvVars: StoredEnvVar[] = [];

function mask(row: StoredEnvVar): EnvVar {
  return {
    id: row.id,
    applicationId: row.applicationId,
    environment: row.environment,
    key: row.key,
    maskedValue: "••••••••",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listEnvVars(
  applicationId: string,
  environment: EnvironmentName,
): Promise<EnvVar[]> {
  if (!isDatabaseEnabled()) {
    return simulatedEnvVars
      .filter(
        (item) =>
          item.applicationId === applicationId &&
          item.environment === environment,
      )
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(mask);
  }
  const rows = await getDb()
    .select()
    .from(schema.envVars)
    .where(
      and(
        eq(schema.envVars.applicationId, applicationId),
        eq(schema.envVars.environment, environment),
      ),
    )
    .orderBy(asc(schema.envVars.key));
  return rows.map(mask);
}

export async function setEnvVar(input: {
  applicationId: string;
  environment: EnvironmentName;
  key: string;
  value: string;
}): Promise<EnvVar> {
  if (!(await getApplication(input.applicationId))) {
    throw new NotFoundError(`Application not found: ${input.applicationId}`);
  }
  if (!isDatabaseEnabled()) {
    const existing = simulatedEnvVars.find(
      (item) =>
        item.applicationId === input.applicationId &&
        item.environment === input.environment &&
        item.key === input.key,
    );
    if (existing) {
      existing.value = input.value;
      return mask(existing);
    }
    const created: StoredEnvVar = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    simulatedEnvVars.push(created);
    return mask(created);
  }

  const [existing] = await getDb()
    .select({ id: schema.envVars.id })
    .from(schema.envVars)
    .where(
      and(
        eq(schema.envVars.applicationId, input.applicationId),
        eq(schema.envVars.environment, input.environment),
        eq(schema.envVars.key, input.key),
      ),
    )
    .limit(1);
  const [row] = existing
    ? await getDb()
        .update(schema.envVars)
        .set({ value: input.value })
        .where(eq(schema.envVars.id, existing.id))
        .returning()
    : await getDb().insert(schema.envVars).values(input).returning();
  return mask(row);
}
