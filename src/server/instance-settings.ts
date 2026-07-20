import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";

export async function getInstanceName(): Promise<string | null> {
  const [settings] = await getDb()
    .select({ name: schema.instanceSettings.name })
    .from(schema.instanceSettings)
    .where(eq(schema.instanceSettings.id, 1))
    .limit(1);
  return settings?.name ?? null;
}

export async function updateInstanceName(name: string): Promise<string> {
  const [settings] = await getDb()
    .insert(schema.instanceSettings)
    .values({ id: 1, name: name.trim() })
    .onConflictDoUpdate({
      target: schema.instanceSettings.id,
      set: { name: name.trim() },
    })
    .returning({ name: schema.instanceSettings.name });
  return settings.name;
}
