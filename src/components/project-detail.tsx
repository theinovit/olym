"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Layers3, LoaderCircle, Plus } from "lucide-react";

import { ProjectCanvas } from "@/components/project-canvas";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import type { Application, AppStatus, Binding, Deployment, Domain, EnvironmentName, Project, ServiceInstance, ServiceTemplate } from "@/lib/types";

function aggregateStatus(statuses: AppStatus[]): AppStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("building")) return "building";
  if (statuses.includes("stopped")) return "stopped";
  return "running";
}

const environmentNames: EnvironmentName[] = ["development", "staging", "production"];
const environmentLabels: Record<EnvironmentName, string> = { development: "Development", staging: "Staging", production: "Production" };

export function ProjectDetail({ project }: { project: Project }) {
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [allServices, setAllServices] = useState<ServiceInstance[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([]);
  const [allBindings, setAllBindings] = useState<Binding[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentName>("development");
  const [enabledEnvironments, setEnabledEnvironments] = useState<EnvironmentName[]>(["development"]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadCollection = async <T,>(endpoint: string): Promise<T[]> => {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json() as { data?: T[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? `Could not load ${endpoint}`);
      return body.data ?? [];
    };
    Promise.all([
      loadCollection<Application>("/api/applications"),
      loadCollection<ServiceInstance>("/api/service-instances"),
      loadCollection<Domain>("/api/domains"),
      loadCollection<Deployment>("/api/deployments"),
      loadCollection<Binding>("/api/bindings"),
      loadCollection<ServiceTemplate>("/api/service-templates"),
    ]).then(([applications, services, domains, deployments, bindings, serviceTemplates]) => {
      if (cancelled) return;
      const projectApps = applications.filter((app) => app.projectId === project.id);
      const projectServices = services.filter((service) => service.projectId === project.id);
      const appIds = new Set(projectApps.map((app) => app.id));
      const serviceIds = new Set(projectServices.map((service) => service.id));
      setAllApps(projectApps);
      setAllServices(projectServices);
      setAllDomains(domains.filter((domain) => appIds.has(domain.applicationId)));
      setAllDeployments(deployments.filter((deployment) => appIds.has(deployment.applicationId)));
      setAllBindings(bindings.filter((binding) => appIds.has(binding.applicationId) && serviceIds.has(binding.serviceInstanceId)));
      setTemplates(serviceTemplates);
      setEnabledEnvironments(environmentNames.filter((name) => name === "development" || projectApps.some((app) => app.environment === name) || projectServices.some((service) => service.environment === name)));
    }).catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load project resources"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  const apps = allApps.filter((app) => app.environment === environment);
  const services = allServices.filter((service) => service.environment === environment);
  const unusedEnvironments = environmentNames.filter((name) => !enabledEnvironments.includes(name));
  const appIds = new Set(allApps.map((app) => app.id));
  const deployments = allDeployments.filter((deployment) => appIds.has(deployment.applicationId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const activeApplicationIds = deployments.filter((deployment) => deployment.status === "building" || deployment.status === "deploying").map((deployment) => deployment.applicationId);

  if (loading) return <div className="fixed inset-0 z-10 flex items-center justify-center gap-2 bg-neutral-50 text-sm text-muted-foreground dark:bg-neutral-950"><LoaderCircle className="size-4 animate-spin" />Loading project resources…</div>;
  if (error) return <div role="alert" className="fixed inset-0 z-10 flex items-center justify-center bg-neutral-50 text-sm text-red-600 dark:bg-neutral-950 dark:text-red-400">{error}</div>;

  return <div className="fixed inset-0 z-10 overflow-hidden">
    <style>{`.project-floating-title { position: absolute; top: 16px; left: 224px; z-index: 20; pointer-events: none; } .project-floating-environment { position: absolute; top: 16px; right: 176px; z-index: 20; } @media (max-width: 767px) { .project-floating-title, .project-floating-environment { display: none; } }`}</style>
    <ProjectCanvas key={environment} project={project} environment={environment} applications={apps} services={services} templates={templates} domains={allDomains} deployments={deployments} bindings={allBindings} activeApplicationIds={activeApplicationIds} addOpen={addOpen} onAddOpenChange={setAddOpen} />
    <div aria-hidden={addOpen} className={`project-floating-title transition-[opacity,transform] duration-150 ${addOpen ? "translate-x-6 opacity-0" : "translate-x-0 opacity-100"}`}><div className="flex items-center gap-3"><h1 className="text-xl font-semibold tracking-tight drop-shadow-sm">{project.name}</h1>{allApps.length > 0 && <StatusBadge status={aggregateStatus(allApps.map((app) => app.status))} />}</div><p className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground">{project.description}</p></div>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="project-floating-environment min-w-40 justify-between rounded-2xl bg-white/95 shadow-md backdrop-blur-sm dark:bg-neutral-900/95"><span className="flex items-center gap-2"><Layers3 className="size-4 text-[#f54900]" />{environmentLabels[environment]}</span><ChevronsUpDown className="size-3.5 text-muted-foreground" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52 rounded-xl"><DropdownMenuLabel>Environment</DropdownMenuLabel>{enabledEnvironments.map((name) => <DropdownMenuItem key={name} onSelect={() => setEnvironment(name)}><span className="capitalize">{environmentLabels[name]}</span>{environment === name && <Check className="ml-auto size-4 text-[#f54900]" />}</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuSub><DropdownMenuSubTrigger disabled={!unusedEnvironments.length}><Plus className="size-4" />Add environment</DropdownMenuSubTrigger><DropdownMenuSubContent className="w-40">{unusedEnvironments.map((name) => <DropdownMenuItem key={name} onSelect={() => { setEnabledEnvironments((current) => [...current, name]); setEnvironment(name); }}>{environmentLabels[name]}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub></DropdownMenuContent></DropdownMenu>
    <Toaster richColors position="bottom-right" />
  </div>;
}
