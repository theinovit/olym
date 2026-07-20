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

  return <div className="fixed inset-0 z-10 overflow-hidden">
    <style>{`.project-floating-title { position: absolute; top: 16px; left: 224px; z-index: 20; pointer-events: none; } .project-floating-environment { position: absolute; top: 16px; right: 176px; z-index: 20; } @media (max-width: 767px) { .project-floating-title, .project-floating-environment { display: none; } }`}</style>
    <ProjectCanvas project={project} applications={apps} services={services} templates={mockServiceTemplates} domains={mockDomains} deployments={deployments} bindings={mockBindings} activeApplicationIds={activeApplicationIds} />
    <div className="project-floating-title"><div className="flex items-center gap-3"><h1 className="text-xl font-semibold tracking-tight drop-shadow-sm">{project.name}</h1>{allApps.length > 0 && <StatusBadge status={aggregateStatus(allApps.map((app) => app.status))} />}</div><p className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground">{project.description}</p></div>
    <Tabs value={environment} onValueChange={(value) => setEnvironment(value as EnvironmentName)} className="project-floating-environment"><TabsList className="rounded-2xl border bg-white/95 shadow-md backdrop-blur-sm dark:bg-neutral-900/95"><TabsTrigger value="production">Production</TabsTrigger><TabsTrigger value="staging">Staging</TabsTrigger><TabsTrigger value="development">Development</TabsTrigger></TabsList></Tabs>
    <Toaster richColors position="bottom-right" />
  </div>;
}
