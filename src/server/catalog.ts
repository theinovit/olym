import type { ServiceTemplate } from "@/lib/types";

export type CatalogServiceTemplate = ServiceTemplate & {
  dockerImage: string;
};

export const serviceCatalog: CatalogServiceTemplate[] = [
  { id: "postgres", name: "PostgreSQL", description: "Reliable open-source relational database.", category: "database", defaultVersion: "17", dockerImage: "postgres:17-alpine" },
  { id: "mysql", name: "MySQL", description: "Popular open-source relational database.", category: "database", defaultVersion: "8.4", dockerImage: "mysql:8.4" },
  { id: "mariadb", name: "MariaDB", description: "Community-developed MySQL-compatible database.", category: "database", defaultVersion: "11.8", dockerImage: "mariadb:11.8" },
  { id: "mongodb", name: "MongoDB", description: "Document-oriented NoSQL database.", category: "database", defaultVersion: "8.0", dockerImage: "mongo:8.0" },
  { id: "redis", name: "Redis", description: "In-memory data store for caching and queues.", category: "cache", defaultVersion: "8", dockerImage: "redis:8-alpine" },
  { id: "minio", name: "MinIO", description: "S3-compatible object storage.", category: "storage", defaultVersion: "latest", dockerImage: "minio/minio:latest" },
  { id: "meilisearch", name: "Meilisearch", description: "Fast, developer-friendly search engine.", category: "search", defaultVersion: "1.15", dockerImage: "getmeili/meilisearch:v1.15" },
  { id: "qdrant", name: "Qdrant", description: "Vector database and similarity search engine.", category: "search", defaultVersion: "1.14", dockerImage: "qdrant/qdrant:v1.14.1" },
  { id: "rabbitmq", name: "RabbitMQ", description: "Message broker for reliable asynchronous workloads.", category: "queue", defaultVersion: "4.1", dockerImage: "rabbitmq:4.1-management-alpine" },
  { id: "clickhouse", name: "ClickHouse", description: "Column-oriented database for real-time analytics.", category: "analytics", defaultVersion: "25.6", dockerImage: "clickhouse/clickhouse-server:25.6-alpine" },
];
