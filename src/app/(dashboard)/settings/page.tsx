"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

type InstanceSettingsResponse = { name?: string; data?: { name?: string }; error?: { message?: string } };

function responseName(body: InstanceSettingsResponse) {
  return body.name ?? body.data?.name;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [instanceName, setInstanceName] = useState("");
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [savingInstance, setSavingInstance] = useState(false);

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

  return <div className="mx-auto w-full max-w-5xl space-y-7">
    <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Configure this Olym instance and your dashboard preferences.</p></div>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><CardTitle>General</CardTitle><CardDescription>Basic information shown across your dashboard.</CardDescription></CardHeader><CardContent><form onSubmit={saveInstance} className="space-y-4"><div className="space-y-2"><Label htmlFor="instance-name">Instance name</Label><Input id="instance-name" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder={loadingInstance ? "Loading instance…" : "Acme Infra"} disabled={loadingInstance || savingInstance} required maxLength={80} /></div><Button type="submit" disabled={loadingInstance || savingInstance}>{savingInstance ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{savingInstance ? "Saving…" : "Save changes"}</Button></form></CardContent></Card>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how Olym looks on this device.</CardDescription></CardHeader><CardContent><div className="max-w-xs space-y-2" suppressHydrationWarning><Label>Theme</Label><Select value={theme ?? "light"} onValueChange={setTheme}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div></CardContent></Card>
    <Card className="border-red-200 bg-red-50/30 [--card-spacing:--spacing(6)] dark:border-red-950 dark:bg-red-950/10"><CardHeader><CardTitle className="text-red-700 dark:text-red-400">Danger Zone</CardTitle><CardDescription>Destructive actions for this instance.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Delete instance data</p><p className="mt-1 text-xs text-muted-foreground">Permanently remove projects, deployments, and configuration.</p></div><Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950" onClick={() => toast.error("Action disabled in preview mode")}><Trash2 className="size-4" />Delete data</Button></CardContent></Card>
    <Toaster richColors position="bottom-right" />
  </div>;
}
