import { randomBytes } from "node:crypto";
import type Docker from "dockerode";

import type { CatalogServiceTemplate } from "../catalog";

export type ServiceCredentials = Record<string, string>;

const identifier = (prefix: string) =>
  `${prefix}_${randomBytes(6).toString("hex")}`;
const secret = () => randomBytes(24).toString("base64url");

export function serviceContainerName(serviceInstanceId: string): string {
  return `olym-svc-${serviceInstanceId.replaceAll("-", "").slice(0, 12)}`;
}

export function generateServiceCredentials(
  template: CatalogServiceTemplate,
): ServiceCredentials {
  switch (template.id) {
    case "postgres":
    case "mysql":
    case "mariadb":
    case "mongodb":
    case "clickhouse":
      return {
        user: identifier("olym"),
        password: secret(),
        database: identifier("app"),
        ...(template.id === "mysql" || template.id === "mariadb"
          ? { rootPassword: secret() }
          : {}),
      };
    case "redis":
      return { password: secret() };
    case "minio":
      return { accessKey: identifier("olym"), secretKey: secret() };
    case "meilisearch":
      return { masterKey: secret() };
    case "qdrant":
      return { apiKey: secret() };
    case "rabbitmq":
      return { user: identifier("olym"), password: secret() };
    default:
      throw new Error(`Unsupported service template: ${template.id}`);
  }
}

export function serviceContainerConfig(
  template: CatalogServiceTemplate,
  credentials: ServiceCredentials,
): Pick<Docker.ContainerCreateOptions, "Env" | "Cmd" | "ExposedPorts"> {
  switch (template.id) {
    case "postgres":
      return {
        Env: [
          `POSTGRES_USER=${credentials.user}`,
          `POSTGRES_PASSWORD=${credentials.password}`,
          `POSTGRES_DB=${credentials.database}`,
        ],
        ExposedPorts: { "5432/tcp": {} },
      };
    case "mysql":
      return {
        Env: [
          `MYSQL_USER=${credentials.user}`,
          `MYSQL_PASSWORD=${credentials.password}`,
          `MYSQL_DATABASE=${credentials.database}`,
          `MYSQL_ROOT_PASSWORD=${credentials.rootPassword}`,
        ],
        ExposedPorts: { "3306/tcp": {} },
      };
    case "mariadb":
      return {
        Env: [
          `MARIADB_USER=${credentials.user}`,
          `MARIADB_PASSWORD=${credentials.password}`,
          `MARIADB_DATABASE=${credentials.database}`,
          `MARIADB_ROOT_PASSWORD=${credentials.rootPassword}`,
        ],
        ExposedPorts: { "3306/tcp": {} },
      };
    case "mongodb":
      return {
        Env: [
          `MONGO_INITDB_ROOT_USERNAME=${credentials.user}`,
          `MONGO_INITDB_ROOT_PASSWORD=${credentials.password}`,
          `MONGO_INITDB_DATABASE=${credentials.database}`,
        ],
        ExposedPorts: { "27017/tcp": {} },
      };
    case "redis":
      return {
        Cmd: ["redis-server", "--appendonly", "yes", "--requirepass", credentials.password],
        ExposedPorts: { "6379/tcp": {} },
      };
    case "minio":
      return {
        Env: [
          `MINIO_ROOT_USER=${credentials.accessKey}`,
          `MINIO_ROOT_PASSWORD=${credentials.secretKey}`,
        ],
        Cmd: ["server", "/data", "--console-address", ":9001"],
        ExposedPorts: { "9000/tcp": {}, "9001/tcp": {} },
      };
    case "meilisearch":
      return {
        Env: [`MEILI_MASTER_KEY=${credentials.masterKey}`],
        ExposedPorts: { "7700/tcp": {} },
      };
    case "qdrant":
      return {
        Env: [`QDRANT__SERVICE__API_KEY=${credentials.apiKey}`],
        ExposedPorts: { "6333/tcp": {} },
      };
    case "rabbitmq":
      return {
        Env: [
          `RABBITMQ_DEFAULT_USER=${credentials.user}`,
          `RABBITMQ_DEFAULT_PASS=${credentials.password}`,
        ],
        ExposedPorts: { "5672/tcp": {}, "15672/tcp": {} },
      };
    case "clickhouse":
      return {
        Env: [
          `CLICKHOUSE_USER=${credentials.user}`,
          `CLICKHOUSE_PASSWORD=${credentials.password}`,
          `CLICKHOUSE_DB=${credentials.database}`,
        ],
        ExposedPorts: { "9000/tcp": {}, "8123/tcp": {} },
      };
    default:
      throw new Error(`Unsupported service template: ${template.id}`);
  }
}
