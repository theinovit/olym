"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Boxes,
  FolderKanban,
  LoaderCircle,
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
import type { Application, Deployment, Project, Server } from "@/lib/types";

function timeAgo(iso: string): string {
  const diffMin = Math.max(
    0,
    Math.round(
      (Date.now() - new Date(iso).getTime()) / 60000
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
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load dashboard"))
      .finally(() => setLoading(false));
  }, []);
  const appsById = new Map(applications.map((app) => [app.id, app]));
  const appsRunning = applications.filter(
    (app) => app.status === "running"
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const deploymentsToday = deployments.filter((dep) =>
    dep.startedAt.startsWith(today)
  ).length;
  const serversOnline = servers.filter(
    (server) => server.status === "online"
  ).length;

  const stats = [
    {
      label: "Projects",
      value: String(projects.length),
      hint: `Across ${servers.length} ${servers.length === 1 ? "server" : "servers"}`,
      icon: FolderKanban,
    },
    {
      label: "Apps running",
      value: `${appsRunning}/${applications.length}`,
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
      value: `${serversOnline}/${servers.length}`,
      hint: servers[0]?.name ?? "No servers connected",
      icon: ServerIcon,
    },
  ];

  const recentDeployments = [...deployments]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 6);

  if (loading) return <div className="flex min-h-[calc(100svh-136px)] items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading dashboard…</div>;
  if (error) return <div role="alert" className="flex min-h-[calc(100svh-136px)] items-center justify-center text-sm text-red-600 dark:text-red-400">{error}</div>;
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
              {projects.map((project) => {
                const apps = applications.filter(
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
