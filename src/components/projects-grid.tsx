"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Boxes, Clock3, Plus, Search } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MOCK_NOW, mockApplications, mockDeployments, mockProjects } from "@/lib/mock-data";
import type { AppStatus } from "@/lib/types";

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((new Date(MOCK_NOW).getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function aggregateStatus(statuses: AppStatus[]): AppStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("building")) return "building";
  if (statuses.includes("stopped")) return "stopped";
  return "running";
}

export function ProjectsGrid() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const projects = mockProjects.filter((project) =>
    [project.name, project.description ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Workspace / Projects</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage applications and environments across your infrastructure.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects..." className="pl-8" />
          </div>
          <Button asChild className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">
            <Link href="/projects/new"><Plus className="size-4" />New Project</Link>
          </Button>
        </div>
      </div>

      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const apps = mockApplications.filter((app) => app.projectId === project.id);
            const appIds = new Set(apps.map((app) => app.id));
            const latestDeploy = mockDeployments.filter((deployment) => appIds.has(deployment.applicationId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
            const environments = [...new Set(apps.map((app) => app.environment))];
            return (
              <Card key={project.id} className="[--card-spacing:--spacing(5)] transition-colors hover:ring-foreground/20">
                <CardHeader className="grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base font-semibold">{project.name}</CardTitle>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{project.description}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Open ${project.name}`}><ArrowUpRight className="size-4" /></Button>
                </CardHeader>
                <CardContent className="mt-auto space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {environments.map((environment) => <Badge key={environment} variant="outline" className="font-normal capitalize">{environment}</Badge>)}
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Boxes className="size-3.5" />{apps.length} {apps.length === 1 ? "app" : "apps"}</div>
                    <StatusBadge status={aggregateStatus(apps.map((app) => app.status))} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Last deploy {latestDeploy ? timeAgo(latestDeploy.startedAt) : "not deployed"}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card py-16 text-center text-sm text-muted-foreground">No projects match “{query}”.</div>
      )}
    </div>
  );
}
