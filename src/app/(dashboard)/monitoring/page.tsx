"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, HardDrive, HeartPulse, LoaderCircle, MemoryStick, Rocket, Server as ServerIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Application, Deployment, Project, Server } from "@/lib/types";

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: number }) {
  return <div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-3.5" />{label}</span><span className="font-medium">{value}%</span></div><Progress value={value} /></div>;
}

export default function MonitoringPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const endpoints = ["/api/projects", "/api/applications", "/api/deployments", "/api/servers"];
    Promise.all(endpoints.map((endpoint) => fetch(endpoint, { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { data?: unknown[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? `Could not load ${endpoint}`);
      return body.data ?? [];
    }))).then(([loadedProjects, loadedApplications, loadedDeployments, loadedServers]) => {
      setProjects(loadedProjects as Project[]);
      setApplications(loadedApplications as Application[]);
      setDeployments(loadedDeployments as Deployment[]);
      setServers(loadedServers as Server[]);
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load monitoring data"))
      .finally(() => setLoading(false));
  }, []);
  const appsById = new Map(applications.map((app) => [app.id, app]));
  const recentDeployments = [...deployments].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 6);
  const healthyApps = applications.filter((app) => app.status === "running").length;
  const healthPct = Math.round((healthyApps / Math.max(1, applications.length)) * 100);

  if (loading) return <div className="flex min-h-[calc(100svh-136px)] items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading monitoring…</div>;
  if (error) return <div role="alert" className="flex min-h-[calc(100svh-136px)] items-center justify-center text-sm text-red-600 dark:text-red-400">{error}</div>;

  return <div className="mx-auto w-full max-w-7xl space-y-7">
    <div><h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1><p className="mt-1 text-sm text-muted-foreground">Health and resource usage across your infrastructure.</p></div>
    <section className="space-y-3"><div><h2 className="font-semibold">Server resources</h2><p className="text-sm text-muted-foreground">Current utilization reported by connected hosts.</p></div><div className="grid gap-4 lg:grid-cols-2">{servers.map((server) => <Card key={server.id} className="[--card-spacing:--spacing(5)]"><CardHeader><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg border bg-muted/40"><ServerIcon className="size-4" /></span><div><CardTitle>{server.name}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{server.host}</p></div></div><StatusBadge status={server.status} /></div></CardHeader><CardContent className="grid gap-5 sm:grid-cols-3"><Metric icon={Cpu} label="CPU" value={server.cpuUsagePct} /><Metric icon={MemoryStick} label="RAM" value={server.memoryUsagePct} /><Metric icon={HardDrive} label="Disk" value={server.diskUsagePct} /></CardContent></Card>)}</div></section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4" />Recent deployment activity</CardTitle></CardHeader><CardContent><div className="divide-y">{recentDeployments.map((deployment) => { const app = appsById.get(deployment.applicationId); return <div key={deployment.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-lg border bg-muted/30"><Rocket className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{deployment.commitMessage}</p><p className="mt-0.5 text-xs text-muted-foreground">{app?.name} · <span className="font-mono">{deployment.commitSha}</span> · {timeAgo(deployment.startedAt)}</p></div><StatusBadge status={deployment.status} /></div>; })}</div></CardContent></Card>
      <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="size-4" />Application health</CardTitle></CardHeader><CardContent className="space-y-5"><div><div className="flex items-end justify-between"><span className="text-3xl font-semibold tracking-tight">{healthPct}%</span><span className="text-xs text-muted-foreground">{healthyApps}/{applications.length} healthy</span></div><Progress value={healthPct} className="mt-3" /></div><div className="space-y-2">{applications.map((app) => { const project = projects.find((item) => item.id === app.projectId); return <div key={app.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{app.name}</p><p className="truncate text-xs text-muted-foreground">{project?.name}</p></div><StatusBadge status={app.status} /></div>; })}</div></CardContent></Card>
    </div>
  </div>;
}
