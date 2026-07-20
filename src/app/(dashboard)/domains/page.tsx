"use client";

import { useState } from "react";
import { Globe2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { mockApplications, mockDomains } from "@/lib/mock-data";
import type { Domain } from "@/lib/types";

const sslClasses: Record<Domain["sslStatus"], string> = { active: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400", pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400", failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400" };

export default function DomainsPage() {
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [applicationId, setApplicationId] = useState(mockApplications[0]?.id ?? "");
  function submit(event: React.FormEvent) { event.preventDefault(); setOpen(false); toast.success("Domain added", { description: `${hostname} is pending DNS verification.` }); }
  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">Infrastructure / Domains</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Domains</h1><p className="mt-1 text-sm text-muted-foreground">Manage hostnames and automatic SSL certificates.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"><Plus className="size-4" />Add Domain</Button></DialogTrigger><DialogContent><form onSubmit={submit} className="contents"><DialogHeader><DialogTitle>Add domain</DialogTitle><DialogDescription>Attach a hostname to an application. SSL will be provisioned automatically.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="hostname">Hostname</Label><Input id="hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="app.example.com" required /></div><div className="space-y-2"><Label>Application</Label><Select value={applicationId} onValueChange={setApplicationId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{mockApplications.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter showCloseButton><Button type="submit">Add Domain</Button></DialogFooter></form></DialogContent></Dialog></div>
    <Card className="py-0"><CardContent className="px-0"><Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-5">Hostname</TableHead><TableHead>Application</TableHead><TableHead>Type</TableHead><TableHead className="pr-5">SSL</TableHead></TableRow></TableHeader><TableBody>{mockDomains.map((domain) => { const app = mockApplications.find((item) => item.id === domain.applicationId); return <TableRow key={domain.id}><TableCell className="pl-5"><span className="flex items-center gap-2 font-medium"><Globe2 className="size-4 text-muted-foreground" />{domain.hostname}</span></TableCell><TableCell className="text-muted-foreground">{app?.name ?? "Unknown app"}</TableCell><TableCell>{domain.isPrimary ? <Badge variant="outline">Primary</Badge> : <span className="text-sm text-muted-foreground">Alias</span>}</TableCell><TableCell className="pr-5"><Badge variant="outline" className={cn("capitalize", sslClasses[domain.sslStatus])}>{domain.sslStatus}</Badge></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>
    <Toaster richColors position="bottom-right" />
  </div>;
}
