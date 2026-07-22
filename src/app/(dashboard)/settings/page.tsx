"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { Globe2, LoaderCircle, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type InstanceSettingsResponse = { name?: string; data?: { name?: string }; error?: { message?: string } };
type SslStatus = "none" | "pending" | "active" | "failed";
type DomainSettings = { domain: string | null; acmeEmail: string | null; sslStatus: SslStatus };
type DomainSettingsResponse = DomainSettings & { data?: DomainSettings; error?: { message?: string } };

const domainStatus = {
  none: { label: "Not configured", className: "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400" },
  pending: { label: "Issuing certificate", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400" },
  active: { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400" },
  failed: { label: "Failed", className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400" },
} satisfies Record<SslStatus, { label: string; className: string }>;

function responseName(body: InstanceSettingsResponse) {
  return body.name ?? body.data?.name;
}

function responseDomain(body: DomainSettingsResponse): DomainSettings {
  return body.data ?? { domain: body.domain, acmeEmail: body.acmeEmail, sslStatus: body.sslStatus };
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [instanceName, setInstanceName] = useState("");
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [savingInstance, setSavingInstance] = useState(false);
  const [domain, setDomain] = useState("");
  const [acmeEmail, setAcmeEmail] = useState("");
  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [sslStatus, setSslStatus] = useState<SslStatus>("none");
  const [loadingDomain, setLoadingDomain] = useState(true);
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/instance", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as InstanceSettingsResponse;
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load instance settings");
        const name = responseName(body);
        if (!name) throw new Error("The instance name is missing from the response");
        if (!cancelled) setInstanceName(name);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load instance settings");
      })
      .finally(() => {
        if (!cancelled) setLoadingInstance(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/domain", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as DomainSettingsResponse;
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load domain settings");
        const settings = responseDomain(body);
        if (!cancelled) {
          setDomain(settings.domain ?? "");
          setAcmeEmail(settings.acmeEmail ?? "");
          setSavedDomain(settings.domain);
          setSslStatus(settings.sslStatus);
          setDomainError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) setDomainError(error instanceof Error ? error.message : "Could not load domain settings");
      })
      .finally(() => {
        if (!cancelled) setLoadingDomain(false);
      });
    return () => { cancelled = true; };
  }, []);

  const saveInstance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingInstance(true);
    try {
      const response = await fetch("/api/settings/instance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: instanceName.trim() }) });
      const body = await response.json().catch(() => ({})) as InstanceSettingsResponse;
      if (!response.ok) throw new Error(body.error?.message ?? "Could not save instance settings");
      setInstanceName(responseName(body) ?? instanceName.trim());
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save instance settings");
    } finally {
      setSavingInstance(false);
    }
  };

  const enableHttps = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingDomain(true);
    setDomainError(null);
    try {
      const response = await fetch("/api/settings/domain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostname: domain.trim(), acmeEmail: acmeEmail.trim() }) });
      const body = await response.json().catch(() => ({})) as DomainSettingsResponse;
      if (!response.ok) throw new Error(body.error?.message ?? "Could not enable HTTPS");
      const settings = responseDomain(body);
      setDomain(settings.domain ?? domain.trim());
      setAcmeEmail(settings.acmeEmail ?? acmeEmail.trim());
      setSavedDomain(settings.domain);
      setSslStatus(settings.sslStatus);
      toast.success(settings.sslStatus === "active" ? "HTTPS is active" : "Domain verified. Certificate issuance started.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not enable HTTPS";
      setDomainError(message);
      toast.error(message);
    } finally {
      setSavingDomain(false);
    }
  };

  const normalizedDomain = domain.trim().toLowerCase();
  const activeForCurrentDomain = sslStatus === "active" && savedDomain?.toLowerCase() === normalizedDomain;
  const currentDomainStatus = savingDomain
    ? { label: "Verifying DNS", className: domainStatus.pending.className }
    : domainStatus[sslStatus];

  return <div className="mx-auto w-full max-w-5xl space-y-7">
    <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Configure this Olym instance and your dashboard preferences.</p></div>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><CardTitle>General</CardTitle><CardDescription>Basic information shown across your dashboard.</CardDescription></CardHeader><CardContent><form onSubmit={saveInstance} className="space-y-4"><div className="space-y-2"><Label htmlFor="instance-name">Instance name</Label><Input id="instance-name" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder={loadingInstance ? "Loading instance…" : "Acme Infra"} disabled={loadingInstance || savingInstance} required maxLength={80} /></div><Button type="submit" disabled={loadingInstance || savingInstance}>{savingInstance ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{savingInstance ? "Saving…" : "Save changes"}</Button></form></CardContent></Card>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1.5"><CardTitle>Domain</CardTitle><CardDescription>Point a hostname to this server and enable HTTPS with Let&apos;s Encrypt.</CardDescription></div><Badge variant="outline" className={cn("gap-1.5", currentDomainStatus.className)}>{savingDomain ? <LoaderCircle className="animate-spin" /> : sslStatus === "active" ? <ShieldCheck /> : <Globe2 />}{currentDomainStatus.label}</Badge></div></CardHeader><CardContent><form onSubmit={enableHttps} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="domain-hostname">Hostname</Label><Input id="domain-hostname" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder={loadingDomain ? "Loading domain…" : "olym.example.com"} disabled={loadingDomain || savingDomain} required autoCapitalize="none" autoCorrect="off" /></div><div className="space-y-2"><Label htmlFor="domain-acme-email">Certificate email</Label><Input id="domain-acme-email" type="email" value={acmeEmail} onChange={(event) => setAcmeEmail(event.target.value)} placeholder="admin@example.com" disabled={loadingDomain || savingDomain} required autoCapitalize="none" autoCorrect="off" /></div></div>{domainError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{domainError}</p>}<Button type="submit" disabled={loadingDomain || savingDomain || activeForCurrentDomain}>{savingDomain ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{savingDomain ? "Verifying DNS…" : activeForCurrentDomain ? "HTTPS enabled" : "Enable HTTPS"}</Button></form></CardContent></Card>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how Olym looks on this device.</CardDescription></CardHeader><CardContent><div className="max-w-xs space-y-2" suppressHydrationWarning><Label>Theme</Label><Select value={theme ?? "light"} onValueChange={setTheme}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div></CardContent></Card>
    <Card className="border-red-200 bg-red-50/30 [--card-spacing:--spacing(6)] dark:border-red-950 dark:bg-red-950/10"><CardHeader><CardTitle className="text-red-700 dark:text-red-400">Danger Zone</CardTitle><CardDescription>Destructive actions for this instance.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Delete instance data</p><p className="mt-1 text-xs text-muted-foreground">Permanently remove projects, deployments, and configuration.</p></div><Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950" onClick={() => toast.error("Action disabled in preview mode")}><Trash2 className="size-4" />Delete data</Button></CardContent></Card>
    <Toaster richColors position="bottom-right" />
  </div>;
}
