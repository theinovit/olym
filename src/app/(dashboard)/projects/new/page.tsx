"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderKanban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockServers } from "@/lib/mock-data";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverId, setServerId] = useState(mockServers[0]?.id ?? "");

  function createProject() {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "untitled-project";
    const query = new URLSearchParams({ new: "1", server: serverId, description });
    router.push(`/projects/${slug}?${query}`);
  }

  return <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-xl items-center">
    <Card className="w-full [--card-spacing:--spacing(6)]">
      <CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl border bg-muted/40"><FolderKanban className="size-4" /></span><CardTitle>Create a project</CardTitle><CardDescription>Name the workspace and choose where its services will run. Everything else happens on the canvas.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2"><Label htmlFor="project-name">Name</Label><Input id="project-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="acme-storefront" /></div>
        <div className="space-y-2"><Label htmlFor="project-description">Description</Label><Input id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Customer-facing storefront" /></div>
        <div className="space-y-2"><Label>Server</Label><Select value={serverId} onValueChange={setServerId}><SelectTrigger className="w-full"><SelectValue placeholder="Select a server" /></SelectTrigger><SelectContent>{mockServers.map((server) => <SelectItem key={server.id} value={server.id}>{server.name} · {server.host}</SelectItem>)}</SelectContent></Select></div>
        <Button className="w-full" disabled={!name.trim() || !serverId} onClick={createProject}>Create project <ArrowRight className="size-4" /></Button>
      </CardContent>
    </Card>
  </div>;
}
