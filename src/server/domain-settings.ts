import { resolve4 } from "node:dns/promises";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";

export interface DomainSettings {
  domain: string | null;
  acmeEmail: string | null;
  sslStatus: "none" | "pending" | "active" | "failed";
}

export class DomainDnsError extends Error {
  constructor(public readonly expectedIp: string) {
    super(`DNS ainda não aponta para este servidor (IP esperado: ${expectedIp})`);
    this.name = "DomainDnsError";
  }
}

function dynamicConfiguration(hostname: string): string {
  return `http:
  routers:
    olym-domain:
      rule: "Host(\`${hostname}\`)"
      entryPoints:
        - websecure
      service: olym
      tls:
        certResolver: letsencrypt
  services:
    olym:
      loadBalancer:
        servers:
          - url: "http://olym:3000"
`;
}

async function writeDomainConfiguration(hostname: string): Promise<void> {
  const directory = process.env.TRAEFIK_DYNAMIC_DIRECTORY?.trim() || "/dynamic";
  const destination = path.join(directory, "domain.yml");
  const temporary = `${destination}.tmp`;
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporary, dynamicConfiguration(hostname), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function getDomainSettings(): Promise<DomainSettings | null> {
  const [settings] = await getDb()
    .select({
      domain: schema.instanceSettings.domain,
      acmeEmail: schema.instanceSettings.acmeEmail,
      sslStatus: schema.instanceSettings.sslStatus,
    })
    .from(schema.instanceSettings)
    .where(eq(schema.instanceSettings.id, 1))
    .limit(1);
  return settings ?? null;
}

export async function configureDomain(input: {
  hostname: string;
  acmeEmail: string;
}): Promise<DomainSettings> {
  const expectedIp = process.env.OLYM_PUBLIC_IP?.trim();
  if (!expectedIp) {
    throw new Error("OLYM_PUBLIC_IP is required to validate domain DNS");
  }

  let addresses: string[] = [];
  try {
    addresses = await resolve4(input.hostname);
  } catch {
    throw new DomainDnsError(expectedIp);
  }
  if (!addresses.includes(expectedIp)) throw new DomainDnsError(expectedIp);

  await writeDomainConfiguration(input.hostname);
  const [settings] = await getDb()
    .update(schema.instanceSettings)
    .set({
      domain: input.hostname,
      acmeEmail: input.acmeEmail,
      sslStatus: "pending",
    })
    .where(eq(schema.instanceSettings.id, 1))
    .returning({
      domain: schema.instanceSettings.domain,
      acmeEmail: schema.instanceSettings.acmeEmail,
      sslStatus: schema.instanceSettings.sslStatus,
    });
  if (!settings) throw new Error("Instance settings have not been configured");
  return settings;
}
