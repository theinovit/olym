"use client";

import { useEffect, useState } from "react";
import { Cpu, HardDrive, KeyRound, LoaderCircle, MemoryStick, Plus, Server as ServerIcon } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import type { Server } from "@/lib/types";

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Cpu; label: string; value: number; detail: string }) {
  return <div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-3.5" />{label}</span><span className="font-medium">{value}%</span></div><Progress value={value} /><p className="text-[11px] text-muted-foreground">{detail}</p></div>;
}

export default function ServersPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/servers", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { data?: Server[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load servers");
        setServers(body.data ?? []);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load servers"))
      .finally(() => setLoading(false));
  }, []);
  function submit(event: React.FormEvent) { event.preventDefault(); setOpen(false); toast.success("Server added", { description: `${name || host} is ready for provisioning.` }); }
  return <div className="mx-auto w-full max-w-7xl space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Servers</h1><p className="mt-1 text-sm text-muted-foreground">Monitor the machines running your applications.</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"><Plus className="size-4" />Add Server</Button></DialogTrigger><DialogContent><form onSubmit={submit} className="contents"><DialogHeader><DialogTitle>Add server</DialogTitle><DialogDescription>Connect a Linux host over SSH. This form is a preview only.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="server-name">Name</Label><Input id="server-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="hetzner-fsn1" required /></div><div className="space-y-2"><Label htmlFor="server-host">Host</Label><Input id="server-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="138.201.93.47" required /></div><div className="space-y-2"><Label htmlFor="ssh-key">SSH private key</Label><div className="relative"><KeyRound className="absolute top-2 left-2.5 size-4 text-muted-foreground" /><Input id="ssh-key" type="password" value={sshKey} onChange={(e) => setSshKey(e.target.value)} placeholder="Paste your private key" className="pl-8" required /></div></div></div><DialogFooter showCloseButton><Button type="submit">Add Server</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
    {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading servers…</div> : error ? <p role="alert" className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p> : <div className="grid gap-4 lg:grid-cols-2">{servers.map((server) => <Card key={server.id} className="[--card-spacing:--spacing(6)]"><CardHeader><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40"><ServerIcon className="size-4" /></span><div><CardTitle className="font-semibold">{server.name}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{server.host}</p></div></div><StatusBadge status={server.status} /></div></CardHeader><CardContent className="space-y-5"><div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs"><span className="text-muted-foreground">Docker version</span><span className="font-mono font-medium">{server.dockerVersion}</span></div><div className="grid gap-5 sm:grid-cols-3"><Metric icon={Cpu} label="CPU" value={server.cpuUsagePct} detail={`${server.cpuCores} cores`} /><Metric icon={MemoryStick} label="RAM" value={server.memoryUsagePct} detail={`${Math.round(server.memoryMb / 1024)} GB total`} /><Metric icon={HardDrive} label="Disk" value={server.diskUsagePct} detail={`${server.diskGb} GB total`} /></div></CardContent></Card>)}</div>}
    <Toaster richColors position="bottom-right" />
  </div>;
}
