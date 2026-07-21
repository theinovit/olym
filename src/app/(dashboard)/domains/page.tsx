"use client";

import { useEffect, useState } from "react";
import { Globe2, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { Application, Domain } from "@/lib/types";

const sslClasses: Record<Domain["sslStatus"], string> = { active: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400", pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400", failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400" };

export default function DomainsPage() {
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([fetch("/api/applications", { cache: "no-store" }), fetch("/api/domains", { cache: "no-store" })])
      .then(async ([applicationsResponse, domainsResponse]) => {
        const applicationsBody = await applicationsResponse.json() as { data?: Application[]; error?: { message?: string } };
        const domainsBody = await domainsResponse.json() as { data?: Domain[]; error?: { message?: string } };
        if (!applicationsResponse.ok) throw new Error(applicationsBody.error?.message ?? "Could not load applications");
        if (!domainsResponse.ok) throw new Error(domainsBody.error?.message ?? "Could not load domains");
        const loadedApplications = applicationsBody.data ?? [];
        setApplications(loadedApplications);
        setApplicationId(loadedApplications[0]?.id ?? "");
        setDomains(domainsBody.data ?? []);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load domains"))
      .finally(() => setLoading(false));
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, hostname, isPrimary: !domains.some((domain) => domain.applicationId === applicationId) }) });
      const body = await response.json() as { data?: Domain; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not add domain");
      setDomains((current) => [...current, body.data!]);
      setHostname("");
      setOpen(false);
      toast.success("Domain added", { description: `${body.data.hostname} is pending DNS verification.` });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add domain");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="mx-auto w-full max-w-7xl space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Domains</h1><p className="mt-1 text-sm text-muted-foreground">Manage hostnames and automatic SSL certificates.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={loading || !applications.length} className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"><Plus className="size-4" />Add Domain</Button></DialogTrigger><DialogContent><form onSubmit={submit} className="contents"><DialogHeader><DialogTitle>Add domain</DialogTitle><DialogDescription>Attach a hostname to an application. SSL will be provisioned automatically.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="hostname">Hostname</Label><Input id="hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="app.example.com" required /></div><div className="space-y-2"><Label>Application</Label><Select value={applicationId} onValueChange={setApplicationId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{applications.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div>{error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}</div><DialogFooter showCloseButton><Button type="submit" disabled={submitting || !hostname.trim() || !applicationId}>{submitting ? <><LoaderCircle className="size-4 animate-spin" />Adding…</> : "Add Domain"}</Button></DialogFooter></form></DialogContent></Dialog></div>
    <Card className="py-0"><CardContent className="px-0">{loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading domains…</div> : error && !domains.length ? <p role="alert" className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p> : domains.length ? <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-5">Hostname</TableHead><TableHead>Application</TableHead><TableHead>Type</TableHead><TableHead className="pr-5">SSL</TableHead></TableRow></TableHeader><TableBody>{domains.map((domain) => { const app = applications.find((item) => item.id === domain.applicationId); return <TableRow key={domain.id}><TableCell className="pl-5"><span className="flex items-center gap-2 font-medium"><Globe2 className="size-4 text-muted-foreground" />{domain.hostname}</span></TableCell><TableCell className="text-muted-foreground">{app?.name ?? "Unknown app"}</TableCell><TableCell>{domain.isPrimary ? <Badge variant="outline">Primary</Badge> : <span className="text-sm text-muted-foreground">Alias</span>}</TableCell><TableCell className="pr-5"><Badge variant="outline" className={cn("capitalize", sslClasses[domain.sslStatus])}>{domain.sslStatus}</Badge></TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={Globe2} title="No domains yet" description="Attach a hostname to an application to provision SSL automatically." action={<Button disabled={!applications.length} onClick={() => setOpen(true)}><Plus className="size-4" />Add Domain</Button>} />}</CardContent></Card>
    <Toaster richColors position="bottom-right" />
  </div>;
}
