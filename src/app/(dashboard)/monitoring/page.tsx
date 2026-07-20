import { Activity, Cpu, HardDrive, HeartPulse, MemoryStick, Rocket, Server } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MOCK_NOW, mockApplications, mockDeployments, mockProjects, mockServers } from "@/lib/mock-data";

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((new Date(MOCK_NOW).getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: number }) {
  return <div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-3.5" />{label}</span><span className="font-medium">{value}%</span></div><Progress value={value} /></div>;
}

export default function MonitoringPage() {
  const appsById = new Map(mockApplications.map((app) => [app.id, app]));
  const recentDeployments = [...mockDeployments].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 6);
  const healthyApps = mockApplications.filter((app) => app.status === "running").length;
  const healthPct = Math.round((healthyApps / Math.max(1, mockApplications.length)) * 100);

  return <div className="mx-auto w-full max-w-7xl space-y-7">
    <div><h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1><p className="mt-1 text-sm text-muted-foreground">Health and resource usage across your infrastructure.</p></div>
    <section className="space-y-3"><div><h2 className="font-semibold">Server resources</h2><p className="text-sm text-muted-foreground">Current utilization reported by connected hosts.</p></div><div className="grid gap-4 lg:grid-cols-2">{mockServers.map((server) => <Card key={server.id} className="[--card-spacing:--spacing(5)]"><CardHeader><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg border bg-muted/40"><Server className="size-4" /></span><div><CardTitle>{server.name}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{server.host}</p></div></div><StatusBadge status={server.status} /></div></CardHeader><CardContent className="grid gap-5 sm:grid-cols-3"><Metric icon={Cpu} label="CPU" value={server.cpuUsagePct} /><Metric icon={MemoryStick} label="RAM" value={server.memoryUsagePct} /><Metric icon={HardDrive} label="Disk" value={server.diskUsagePct} /></CardContent></Card>)}</div></section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4" />Recent deployment activity</CardTitle></CardHeader><CardContent><div className="divide-y">{recentDeployments.map((deployment) => { const app = appsById.get(deployment.applicationId); return <div key={deployment.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-lg border bg-muted/30"><Rocket className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{deployment.commitMessage}</p><p className="mt-0.5 text-xs text-muted-foreground">{app?.name} · <span className="font-mono">{deployment.commitSha}</span> · {timeAgo(deployment.startedAt)}</p></div><StatusBadge status={deployment.status} /></div>; })}</div></CardContent></Card>
      <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="size-4" />Application health</CardTitle></CardHeader><CardContent className="space-y-5"><div><div className="flex items-end justify-between"><span className="text-3xl font-semibold tracking-tight">{healthPct}%</span><span className="text-xs text-muted-foreground">{healthyApps}/{mockApplications.length} healthy</span></div><Progress value={healthPct} className="mt-3" /></div><div className="space-y-2">{mockApplications.map((app) => { const project = mockProjects.find((item) => item.id === app.projectId); return <div key={app.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{app.name}</p><p className="truncate text-xs text-muted-foreground">{project?.name}</p></div><StatusBadge status={app.status} /></div>; })}</div></CardContent></Card>
    </div>
  </div>;
}
