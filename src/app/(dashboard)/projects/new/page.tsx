"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderKanban, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project, Server } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverId, setServerId] = useState("");
  const [servers, setServers] = useState<Server[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/servers", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { data?: Server[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load servers");
        const availableServers = body.data ?? [];
        setServers(availableServers);
        setServerId(availableServers[0]?.id ?? "");
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load servers"))
      .finally(() => setLoadingServers(false));
  }, []);

  async function createProject() {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "untitled-project";
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), slug, serverId, description: description.trim() || null }) });
      const body = await response.json() as { data?: Project; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not create project");
      router.push(`/projects/${body.data.slug}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create project");
      setSubmitting(false);
    }
  }

  return <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-xl items-center">
    <Card className="w-full [--card-spacing:--spacing(6)]">
      <CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl border bg-muted/40"><FolderKanban className="size-4" /></span><CardTitle>Create a project</CardTitle><CardDescription>Name the workspace and choose where its services will run. Everything else happens on the canvas.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2"><Label htmlFor="project-name">Name</Label><Input id="project-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="acme-storefront" /></div>
        <div className="space-y-2"><Label htmlFor="project-description">Description</Label><Input id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Customer-facing storefront" /></div>
        <div className="space-y-2"><Label>Server</Label><Select value={serverId} onValueChange={setServerId} disabled={loadingServers || submitting}><SelectTrigger className="w-full"><SelectValue placeholder={loadingServers ? "Loading servers…" : "Select a server"} /></SelectTrigger><SelectContent>{servers.map((server) => <SelectItem key={server.id} value={server.id}>{server.name} · {server.host}</SelectItem>)}</SelectContent></Select></div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button className="w-full" disabled={submitting || loadingServers || !name.trim() || !serverId} onClick={() => void createProject()}>{submitting ? <><LoaderCircle className="size-4 animate-spin" />Creating project…</> : <>Create project <ArrowRight className="size-4" /></>}</Button>
      </CardContent>
    </Card>
  </div>;
}
