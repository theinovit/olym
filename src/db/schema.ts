// Drizzle schema — mirrors the domain contract in src/lib/types.ts.
// Owned by Backend. Migrations live in src/db/migrations (drizzle-kit).

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums (mirror the union types in src/lib/types.ts) ---

export const environmentNameEnum = pgEnum("environment_name", [
  "production",
  "staging",
  "development",
]);

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "queued",
  "building",
  "deploying",
  "running",
  "failed",
  "cancelled",
]);

export const appStatusEnum = pgEnum("app_status", [
  "running",
  "stopped",
  "building",
  "failed",
]);

export const serverStatusEnum = pgEnum("server_status", [
  "online",
  "offline",
  "provisioning",
]);

export const frameworkEnum = pgEnum("framework", [
  "nextjs",
  "nuxt",
  "sveltekit",
  "remix",
  "adonisjs",
  "express",
  "fastify",
  "nestjs",
  "django",
  "rails",
  "laravel",
  "symfony",
  "blazor",
  "phoenix",
  "static",
  "other",
]);

export const serviceCategoryEnum = pgEnum("service_category", [
  "database",
  "cache",
  "storage",
  "search",
  "queue",
  "analytics",
]);

export const sslStatusEnum = pgEnum("ssl_status", [
  "active",
  "pending",
  "failed",
]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const instanceSettings = pgTable(
  "instance_settings",
  {
    id: integer("id").primaryKey().default(1),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("instance_settings_singleton", sql`${table.id} = 1`),
  ],
);

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  status: serverStatusEnum("status").notNull().default("provisioning"),
  cpuCores: integer("cpu_cores").notNull().default(0),
  memoryMb: integer("memory_mb").notNull().default(0),
  diskGb: integer("disk_gb").notNull().default(0),
  cpuUsagePct: real("cpu_usage_pct").notNull().default(0),
  memoryUsagePct: real("memory_usage_pct").notNull().default(0),
  diskUsagePct: real("disk_usage_pct").notNull().default(0),
  dockerVersion: text("docker_version").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  serverId: uuid("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  environment: environmentNameEnum("environment")
    .notNull()
    .default("production"),
  name: text("name").notNull(),
  framework: frameworkEnum("framework").notNull().default("other"),
  repoUrl: text("repo_url"),
  dockerImage: text("docker_image"),
  branch: text("branch").notNull().default("main"),
  buildCommand: text("build_command"),
  installCommand: text("install_command"),
  startCommand: text("start_command"),
  outputDirectory: text("output_directory"),
  port: integer("port").notNull().default(3000),
  status: appStatusEnum("status").notNull().default("stopped"),
  canvasX: real("canvas_x"),
  canvasY: real("canvas_y"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const serviceTemplates = pgTable("service_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  category: serviceCategoryEnum("category").notNull(),
  defaultVersion: text("default_version").notNull(),
});

export const serviceInstances = pgTable("service_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  environment: environmentNameEnum("environment")
    .notNull()
    .default("production"),
  templateId: uuid("template_id")
    .notNull()
    .references(() => serviceTemplates.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  version: text("version").notNull(),
  status: appStatusEnum("status").notNull().default("stopped"),
  canvasX: real("canvas_x"),
  canvasY: real("canvas_y"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bindings = pgTable(
  "bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    serviceInstanceId: uuid("service_instance_id")
      .notNull()
      .references(() => serviceInstances.id, { onDelete: "cascade" }),
    injectedVarKey: text("injected_var_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("bindings_application_service_unique").on(
      table.applicationId,
      table.serviceInstanceId,
    ),
  ],
);

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  status: deploymentStatusEnum("status").notNull().default("queued"),
  commitSha: text("commit_sha").notNull(),
  commitMessage: text("commit_message").notNull(),
  branch: text("branch").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationSec: integer("duration_sec"),
});

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  isPrimary: boolean("is_primary").notNull().default(false),
  sslStatus: sslStatusEnum("ssl_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Note: the DB stores the real value; the API layer masks it into
// EnvVar.maskedValue (src/lib/types.ts) before sending to the client.
export const envVars = pgTable("env_vars", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  environment: environmentNameEnum("environment")
    .notNull()
    .default("production"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Relations ---

export const serversRelations = relations(servers, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  server: one(servers, {
    fields: [projects.serverId],
    references: [servers.id],
  }),
  applications: many(applications),
  serviceInstances: many(serviceInstances),
}));

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [applications.projectId],
      references: [projects.id],
    }),
    deployments: many(deployments),
    domains: many(domains),
    envVars: many(envVars),
    bindings: many(bindings),
  }),
);

export const serviceTemplatesRelations = relations(
  serviceTemplates,
  ({ many }) => ({
    instances: many(serviceInstances),
  }),
);

export const serviceInstancesRelations = relations(
  serviceInstances,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [serviceInstances.projectId],
      references: [projects.id],
    }),
    template: one(serviceTemplates, {
      fields: [serviceInstances.templateId],
      references: [serviceTemplates.id],
    }),
    bindings: many(bindings),
  }),
);

export const bindingsRelations = relations(bindings, ({ one }) => ({
  application: one(applications, {
    fields: [bindings.applicationId],
    references: [applications.id],
  }),
  serviceInstance: one(serviceInstances, {
    fields: [bindings.serviceInstanceId],
    references: [serviceInstances.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  application: one(applications, {
    fields: [deployments.applicationId],
    references: [applications.id],
  }),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  application: one(applications, {
    fields: [domains.applicationId],
    references: [applications.id],
  }),
}));

export const envVarsRelations = relations(envVars, ({ one }) => ({
  application: one(applications, {
    fields: [envVars.applicationId],
    references: [applications.id],
  }),
}));
