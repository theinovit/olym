"use client";

import "@xyflow/react/dist/style.css";

import { useState } from "react";

import { ProjectCanvas } from "@/components/project-canvas";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { mockApplications, mockBindings, mockDeployments, mockDomains, mockServiceInstances, mockServiceTemplates } from "@/lib/mock-data";
import type { AppStatus, EnvironmentName, Project } from "@/lib/types";

function aggregateStatus(statuses: AppStatus[]): AppStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("building")) return "building";
  if (statuses.includes("stopped")) return "stopped";
  return "running";
}

export function ProjectDetail({ project }: { project: Project }) {
  const [environment, setEnvironment] = useState<EnvironmentName>("production");
  const allApps = mockApplications.filter((app) => app.projectId === project.id);
  const apps = allApps.filter((app) => app.environment === environment);
  const services = mockServiceInstances.filter((service) => service.projectId === project.id && service.environment === environment);
  const appIds = new Set(allApps.map((app) => app.id));
  const deployments = mockDeployments.filter((deployment) => appIds.has(deployment.applicationId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const activeApplicationIds = deployments.filter((deployment) => deployment.status === "building" || deployment.status === "deploying").map((deployment) => deployment.applicationId);

  return <div className="mx-auto w-full max-w-[1600px] space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-muted-foreground">Projects / {project.name}</p><div className="mt-1 flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>{allApps.length > 0 && <StatusBadge status={aggregateStatus(allApps.map((app) => app.status))} />}</div><p className="mt-1 text-sm text-muted-foreground">{project.description}</p></div>
      <Tabs value={environment} onValueChange={(value) => setEnvironment(value as EnvironmentName)}><TabsList><TabsTrigger value="production">Production</TabsTrigger><TabsTrigger value="staging">Staging</TabsTrigger><TabsTrigger value="development">Development</TabsTrigger></TabsList></Tabs>
    </div>
    <ProjectCanvas project={project} applications={apps} services={services} templates={mockServiceTemplates} domains={mockDomains} deployments={deployments} bindings={mockBindings} activeApplicationIds={activeApplicationIds} />
    <Toaster richColors position="bottom-right" />
  </div>;
}
