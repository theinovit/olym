import Link from "next/link";
import {
  Boxes,
  FolderKanban,
  Rocket,
  Server as ServerIcon,
} from "lucide-react";

import { StatusBadge, StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MOCK_NOW,
  MOCK_TODAY,
  mockApplications,
  mockDeployments,
  mockProjects,
  mockServers,
} from "@/lib/mock-data";

function timeAgo(iso: string): string {
  const diffMin = Math.max(
    0,
    Math.round(
      (new Date(MOCK_NOW).getTime() - new Date(iso).getTime()) / 60000
    )
  );
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function HomePage() {
  const appsById = new Map(mockApplications.map((app) => [app.id, app]));
  const appsRunning = mockApplications.filter(
    (app) => app.status === "running"
  ).length;
  const deploymentsToday = mockDeployments.filter((dep) =>
    dep.startedAt.startsWith(MOCK_TODAY)
  ).length;
  const serversOnline = mockServers.filter(
    (server) => server.status === "online"
  ).length;

  const stats = [
    {
      label: "Projects",
      value: String(mockProjects.length),
      hint: "Across 1 server",
      icon: FolderKanban,
    },
    {
      label: "Apps running",
      value: `${appsRunning}/${mockApplications.length}`,
      hint: "Applications online",
      icon: Boxes,
    },
    {
      label: "Deployments today",
      value: String(deploymentsToday),
      hint: "Since midnight UTC",
      icon: Rocket,
    },
    {
      label: "Servers online",
      value: `${serversOnline}/${mockServers.length}`,
      hint: mockServers[0].name,
      icon: ServerIcon,
    },
  ];

  const recentDeployments = [...mockDeployments]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 6);

  return (
    <div className="flex min-h-[calc(100svh-136px)] flex-col justify-center">
      <div className="mx-auto w-full max-w-7xl space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, Rodrigo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your projects and servers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="[--card-spacing:--spacing(5)]">
            <CardContent className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.hint}
                </p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
                <stat.icon className="size-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="[--card-spacing:--spacing(5)] lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent deployments</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/deployments">View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recentDeployments.map((dep) => {
                const app = appsById.get(dep.applicationId);
                return (
                  <li
                    key={dep.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <StatusDot status={dep.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {dep.commitMessage}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {app?.name} · {dep.branch} ·{" "}
                        <span className="font-mono">{dep.commitSha}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={dep.status} />
                      <span className="w-16 text-right text-xs text-muted-foreground">
                        {dep.durationSec != null
                          ? formatDuration(dep.durationSec)
                          : timeAgo(dep.startedAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)] lg:col-span-2">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {mockProjects.map((project) => {
                const apps = mockApplications.filter(
                  (app) => app.projectId === project.id
                );
                return (
                  <li
                    key={project.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-xs font-semibold uppercase">
                      {project.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {project.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {apps.length} {apps.length === 1 ? "app" : "apps"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
