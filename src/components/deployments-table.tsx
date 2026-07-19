"use client";

import { useState } from "react";
import { GitBranch, Search } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_NOW, mockApplications, mockDeployments } from "@/lib/mock-data";
import type { DeploymentStatus } from "@/lib/types";

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((new Date(MOCK_NOW).getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function duration(seconds: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

export function DeploymentsTable() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeploymentStatus | "all">("all");
  const appsById = new Map(mockApplications.map((app) => [app.id, app]));
  const normalizedQuery = query.trim().toLowerCase();
  const deployments = [...mockDeployments]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .filter((deployment) => {
      const app = appsById.get(deployment.applicationId);
      const matchesQuery = [app?.name ?? "", deployment.commitMessage, deployment.commitSha, deployment.branch, deployment.triggeredBy].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesQuery && (status === "all" || deployment.status === status);
    });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Workspace / Deployments</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Deployments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track builds and releases across all applications.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search app, commit, branch..." className="pl-8" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as DeploymentStatus | "all")}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{(["queued", "building", "deploying", "running", "failed", "cancelled"] as DeploymentStatus[]).map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-5">Status</TableHead><TableHead>Application</TableHead><TableHead className="min-w-72">Commit</TableHead><TableHead>Branch</TableHead><TableHead>Author</TableHead><TableHead>Duration</TableHead><TableHead className="pr-5 text-right">When</TableHead></TableRow></TableHeader>
            <TableBody>
              {deployments.map((deployment) => {
                const app = appsById.get(deployment.applicationId);
                return <TableRow key={deployment.id}>
                  <TableCell className="pl-5"><StatusBadge status={deployment.status} /></TableCell>
                  <TableCell className="font-medium">{app?.name ?? "Unknown app"}</TableCell>
                  <TableCell><p className="max-w-72 truncate text-sm">{deployment.commitMessage}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{deployment.commitSha}</p></TableCell>
                  <TableCell><span className="inline-flex items-center gap-1.5 text-xs"><GitBranch className="size-3.5 text-muted-foreground" />{deployment.branch}</span></TableCell>
                  <TableCell className="text-muted-foreground">{deployment.triggeredBy}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{duration(deployment.durationSec)}</TableCell>
                  <TableCell className="pr-5 text-right text-muted-foreground">{timeAgo(deployment.startedAt)}</TableCell>
                </TableRow>;
              })}
              {!deployments.length && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No deployments match your filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
