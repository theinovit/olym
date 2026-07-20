"use client";

import "@xyflow/react/dist/style.css";

import { useState } from "react";
import { Box, ExternalLink, GitBranch, RefreshCw, ServerCog } from "lucide-react";
import { toast } from "sonner";

import { ProjectCanvas } from "@/components/project-canvas";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { MOCK_NOW, mockApplications, mockDeployments, mockDomains, mockServiceInstances, mockServiceTemplates } from "@/lib/mock-data";
import type { AppStatus, EnvironmentName, Project } from "@/lib/types";

function aggregateStatus(statuses: AppStatus[]): AppStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("building")) return "building";
  if (statuses.includes("stopped")) return "stopped";
  return "running";
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((new Date(MOCK_NOW).getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export function ProjectDetail({ project }: { project: Project }) {
  const [environment, setEnvironment] = useState<EnvironmentName>("production");
  const allApps = mockApplications.filter((app) => app.projectId === project.id);
  const apps = allApps.filter((app) => app.environment === environment);
  const services = mockServiceInstances.filter((service) => service.projectId === project.id && service.environment === environment);
  const appIds = new Set(allApps.map((app) => app.id));
  const deployments = mockDeployments.filter((deployment) => appIds.has(deployment.applicationId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5);
  const activeApplicationIds = mockDeployments.filter((deployment) => deployment.status === "building" || deployment.status === "deploying").map((deployment) => deployment.applicationId);

  const deploymentList = <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle>Recent deployments</CardTitle></CardHeader><CardContent><div className="divide-y">{deployments.map((deployment) => { const app = allApps.find((item) => item.id === deployment.applicationId); return <div key={deployment.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><StatusBadge status={deployment.status} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{deployment.commitMessage}</p><p className="mt-0.5 text-xs text-muted-foreground">{app?.name} · <span className="font-mono">{deployment.commitSha}</span></p></div><Badge variant="outline" className="font-normal">{timeAgo(deployment.startedAt)}</Badge></div>; })}</div></CardContent></Card>;

  return <div className="mx-auto w-full max-w-7xl space-y-6">
    <div><p className="text-sm text-muted-foreground">Projects / {project.name}</p><div className="mt-1 flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1><StatusBadge status={aggregateStatus(allApps.map((app) => app.status))} /></div><p className="mt-1 text-sm text-muted-foreground">{project.description}</p></div>
    <Tabs defaultValue="canvas" className="gap-5">
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList variant="line"><TabsTrigger value="canvas">Canvas</TabsTrigger><TabsTrigger value="list">List</TabsTrigger><TabsTrigger value="deployments">Deployments</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList>
        <Tabs value={environment} onValueChange={(value) => setEnvironment(value as EnvironmentName)}><TabsList><TabsTrigger value="production">Production</TabsTrigger><TabsTrigger value="staging">Staging</TabsTrigger><TabsTrigger value="development">Development</TabsTrigger></TabsList></Tabs>
      </div>
      <TabsContent value="canvas"><ProjectCanvas applications={apps} services={services} templates={mockServiceTemplates} domains={mockDomains} activeApplicationIds={activeApplicationIds} /></TabsContent>
      <TabsContent value="list" className="space-y-6">
        <section className="space-y-3"><div><h2 className="font-semibold">Applications</h2><p className="text-sm text-muted-foreground">Deployable apps in this environment.</p></div>
          {apps.length ? <div className="grid gap-4 md:grid-cols-2">{apps.map((app) => { const domain = mockDomains.find((item) => item.applicationId === app.id && item.isPrimary); return <Card key={app.id} className="[--card-spacing:--spacing(5)]"><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40"><Box className="size-4" /></span><div className="min-w-0"><CardTitle className="truncate font-semibold">{app.name}</CardTitle><p className="mt-1 text-xs capitalize text-muted-foreground">{app.framework}</p></div></div><StatusBadge status={app.status} /></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span className="flex items-center gap-1.5"><GitBranch className="size-3.5" />{app.branch}</span><span className="flex items-center gap-1.5 truncate"><ExternalLink className="size-3.5" />{domain?.hostname ?? "No primary domain"}</span></div><Button variant="outline" size="sm" onClick={() => toast.success("Redeploy queued", { description: `${app.name} will deploy from ${app.branch}.` })}><RefreshCw className="size-3.5" />Redeploy</Button></CardContent></Card>; })}</div> : <div className="rounded-xl border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">No applications in {environment}.</div>}
        </section>
        <section className="space-y-3"><div><h2 className="font-semibold">Services</h2><p className="text-sm text-muted-foreground">Databases, caches, and storage for this project.</p></div>{services.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map((service) => { const template = mockServiceTemplates.find((item) => item.id === service.templateId); return <Card key={service.id} className="[--card-spacing:--spacing(5)]"><CardContent className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40"><ServerCog className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate font-medium">{service.name}</p><p className="text-xs text-muted-foreground">{template?.name} {service.version}</p></div><StatusBadge status={service.status} /></CardContent></Card>; })}</div> : <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">No services in {environment}.</div>}</section>
        {deploymentList}
      </TabsContent>
      <TabsContent value="deployments">{deploymentList}</TabsContent>
      <TabsContent value="settings"><div className="rounded-2xl border bg-card p-8"><h2 className="font-semibold">Project settings</h2><p className="mt-2 text-sm text-muted-foreground">Configuration for this project will live here.</p></div></TabsContent>
    </Tabs>
    <Toaster richColors position="bottom-right" />
  </div>;
}
