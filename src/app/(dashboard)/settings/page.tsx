"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [instanceName, setInstanceName] = useState("Hefesto Production");

  return <div className="mx-auto w-full max-w-5xl space-y-7">
    <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Configure this Hefesto instance and your dashboard preferences.</p></div>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><CardTitle>General</CardTitle><CardDescription>Basic information shown across your dashboard.</CardDescription></CardHeader><CardContent><form onSubmit={(event) => { event.preventDefault(); toast.success("Settings saved"); }} className="space-y-4"><div className="space-y-2"><Label htmlFor="instance-name">Instance name</Label><Input id="instance-name" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} /></div><Button type="submit"><Save className="size-4" />Save changes</Button></form></CardContent></Card>
    <Card className="[--card-spacing:--spacing(6)]"><CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how Hefesto looks on this device.</CardDescription></CardHeader><CardContent><div className="max-w-xs space-y-2" suppressHydrationWarning><Label>Theme</Label><Select value={theme ?? "light"} onValueChange={setTheme}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div></CardContent></Card>
    <Card className="border-red-200 bg-red-50/30 [--card-spacing:--spacing(6)] dark:border-red-950 dark:bg-red-950/10"><CardHeader><CardTitle className="text-red-700 dark:text-red-400">Danger Zone</CardTitle><CardDescription>Destructive actions for this instance.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Delete instance data</p><p className="mt-1 text-xs text-muted-foreground">Permanently remove projects, deployments, and configuration.</p></div><Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950" onClick={() => toast.error("Action disabled in preview mode")}><Trash2 className="size-4" />Delete data</Button></CardContent></Card>
    <Toaster richColors position="bottom-right" />
  </div>;
}
