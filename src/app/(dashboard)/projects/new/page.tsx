"use client";

import { useMemo, useState } from "react";
import { Check, Cloud, Code2, GitBranch, GitFork, Globe2, HardDrive, Laptop, LockKeyhole, Rocket, Server } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Framework, FrameworkCategory } from "@/lib/types";

const frameworks: { id: Framework; name: string; category: FrameworkCategory; initials: string }[] = [
  { id: "nextjs", name: "Next.js", category: "fullstack", initials: "N" },
  { id: "nuxt", name: "Nuxt", category: "fullstack", initials: "Nu" },
  { id: "sveltekit", name: "SvelteKit", category: "fullstack", initials: "S" },
  { id: "remix", name: "Remix", category: "fullstack", initials: "R" },
  { id: "adonisjs", name: "AdonisJS", category: "backend", initials: "A" },
  { id: "django", name: "Django", category: "backend", initials: "D" },
  { id: "rails", name: "Rails", category: "backend", initials: "Rb" },
  { id: "laravel", name: "Laravel", category: "backend", initials: "L" },
  { id: "static", name: "Static Site", category: "static", initials: "HTML" },
];

const defaults: Record<string, { install: string; build: string; start: string; port: string; output: string }> = {
  nextjs: { install: "pnpm install", build: "pnpm build", start: "pnpm start", port: "3000", output: ".next" },
  nuxt: { install: "pnpm install", build: "pnpm build", start: "node .output/server/index.mjs", port: "3000", output: ".output" },
  sveltekit: { install: "pnpm install", build: "pnpm build", start: "node build", port: "3000", output: "build" },
  static: { install: "pnpm install", build: "pnpm build", start: "", port: "80", output: "dist" },
};

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="font-mono text-xs" /></div>;
}

export default function NewProjectPage() {
  const [category, setCategory] = useState<FrameworkCategory>("fullstack");
  const [framework, setFramework] = useState<Framework>("nextjs");
  const [commands, setCommands] = useState(defaults.nextjs);
  const [buildEnabled, setBuildEnabled] = useState(true);
  const [startEnabled, setStartEnabled] = useState(true);
  const [repo, setRepo] = useState("https://github.com/acme/new-app");
  const [branch, setBranch] = useState("main");
  const [location, setLocation] = useState<"server" | "local">("server");
  const [domainType, setDomainType] = useState<"free" | "custom">("free");
  const [domain, setDomain] = useState("new-app");
  const visibleFrameworks = useMemo(() => frameworks.filter((item) => item.category === category || (category === "frontend" && ["nextjs", "nuxt", "sveltekit", "remix"].includes(item.id))), [category]);
  const selectedName = frameworks.find((item) => item.id === framework)?.name ?? "Other";
  const hostname = domainType === "free" ? `${domain || "new-app"}.hefesto.app` : domain || "your-domain.com";

  function selectFramework(id: Framework) {
    setFramework(id);
    setCommands(defaults[id] ?? { install: "", build: "", start: "", port: "3000", output: "" });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <div><p className="text-sm text-muted-foreground">Projects / New Project</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Deploy a new project</h1><p className="mt-1 text-sm text-muted-foreground">Connect a repository and configure how Hefesto should build and run it.</p></div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="size-4" />Framework</CardTitle><CardDescription>Choose the preset that best matches your application.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <Tabs value={category} onValueChange={(value) => setCategory(value as FrameworkCategory)}><TabsList className="grid h-9 w-full grid-cols-4"><TabsTrigger value="frontend">Frontend</TabsTrigger><TabsTrigger value="backend">Backend</TabsTrigger><TabsTrigger value="fullstack">Fullstack</TabsTrigger><TabsTrigger value="static">Static</TabsTrigger></TabsList></Tabs>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visibleFrameworks.map((item) => <button key={item.id} type="button" onClick={() => selectFramework(item.id)} className={cn("relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm transition-colors hover:bg-muted/50", framework === item.id && "border-foreground ring-2 ring-foreground/10")}>
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-neutral-50 text-xs font-semibold text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">{item.initials}</span><span className="font-medium">{item.name}</span>{framework === item.id && <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-foreground text-background"><Check className="size-2.5" /></span>}
                </button>)}
              </div>
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader><CardTitle>Deploy Configuration</CardTitle><CardDescription>Commands run inside the build environment.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <Field label="Install Command" value={commands.install} onChange={(install) => setCommands({ ...commands, install })} placeholder="pnpm install" />
              <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center justify-between"><div><Label htmlFor="build-toggle">Build</Label><p className="mt-1 text-xs text-muted-foreground">Compile the application before deployment.</p></div><Switch id="build-toggle" checked={buildEnabled} onCheckedChange={setBuildEnabled} /></div>{buildEnabled && <Field label="Build Command" value={commands.build} onChange={(build) => setCommands({ ...commands, build })} placeholder="pnpm build" />}</div>
              <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center justify-between"><div><Label htmlFor="start-toggle">Start</Label><p className="mt-1 text-xs text-muted-foreground">Run a persistent application process.</p></div><Switch id="start-toggle" checked={startEnabled} onCheckedChange={setStartEnabled} /></div>{startEnabled && <Field label="Start Command" value={commands.start} onChange={(start) => setCommands({ ...commands, start })} placeholder="pnpm start" />}</div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Production Port" value={commands.port} onChange={(port) => setCommands({ ...commands, port })} placeholder="3000" /><Field label="Output Directory" value={commands.output} onChange={(output) => setCommands({ ...commands, output })} placeholder=".next" /></div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle className="flex items-center gap-2"><GitFork className="size-4" />Repository</CardTitle><CardDescription>Public or previously authorized Git URL.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Git URL" value={repo} onChange={setRepo} placeholder="https://github.com/org/repo" /><div className="space-y-2"><Label>Branch</Label><Select value={branch} onValueChange={setBranch}><SelectTrigger className="w-full"><GitBranch className="size-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="main">main</SelectItem><SelectItem value="develop">develop</SelectItem><SelectItem value="staging">staging</SelectItem></SelectContent></Select></div></CardContent></Card>
          <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle>Build Location</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-2">{([{ id: "server", label: "Server", icon: Server }, { id: "local", label: "Local", icon: Laptop }] as const).map((item) => <button type="button" key={item.id} onClick={() => setLocation(item.id)} className={cn("flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted/50", location === item.id && "border-foreground bg-muted/50 ring-2 ring-foreground/10")}><item.icon className="size-4" />{item.label}</button>)}</div></CardContent></Card>
          <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="size-4" />Domain</CardTitle></CardHeader><CardContent className="space-y-4"><Tabs value={domainType} onValueChange={(value) => setDomainType(value as "free" | "custom")}><TabsList className="grid h-auto w-full grid-cols-2"><TabsTrigger value="free" className="py-1.5">Free Subdomain</TabsTrigger><TabsTrigger value="custom" className="py-1.5">Custom Domain</TabsTrigger></TabsList></Tabs><div className="flex items-center rounded-lg border focus-within:ring-3 focus-within:ring-ring/50"><Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder={domainType === "free" ? "new-app" : "app.example.com"} className="border-0 shadow-none focus-visible:ring-0" />{domainType === "free" && <span className="pr-2.5 text-xs text-muted-foreground">.hefesto.app</span>}</div><p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><LockKeyhole className="size-3.5" />SSL certificate provisioned automatically</p></CardContent></Card>
          <Button onClick={() => toast.success("Deployment started", { description: `${selectedName} will be deployed from ${branch}.` })} className="h-10 w-full bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"><Rocket className="size-4" />Deploy</Button>
          <Card className="[--card-spacing:--spacing(5)]"><CardHeader><CardTitle>Deploy Summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><Cloud className="size-4" />Domain</span><span className="truncate font-medium">{hostname}</span></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Code2 className="size-4" />Framework</span><span className="font-medium">{selectedName}</span></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><HardDrive className="size-4" />Build</span><span className="font-medium capitalize">{location}</span></div></CardContent></Card>
        </aside>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
