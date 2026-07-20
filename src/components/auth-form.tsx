"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Flame, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "setup";
type AuthStatusResponse = { hasAccount?: boolean; data?: { hasAccount?: boolean } };
type ApiErrorResponse = { error?: { message?: string } };

const localAuthStatus: AuthStatusResponse = { hasAccount: true };

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Auth status is unavailable");
        return response.json() as Promise<AuthStatusResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        const hasAccount = body.hasAccount ?? body.data?.hasAccount ?? localAuthStatus.hasAccount;
        setMode(hasAccount ? "login" : "setup");
      })
      .catch(() => {
        if (!cancelled) setMode(localAuthStatus.hasAccount ? "login" : "setup");
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(mode === "setup" ? { instanceName: instanceName.trim() } : {}), email: email.trim(), password }),
      });
      const body = await response.json().catch(() => ({})) as ApiErrorResponse;
      if (!response.ok) throw new Error(body.error?.message ?? (response.status === 401 ? "Invalid email or password." : "Authentication failed. Please try again."));
      router.replace("/home");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const setup = mode === "setup";
  return <Card className="w-full max-w-[420px] gap-0 rounded-2xl border border-neutral-200 bg-white/95 py-0 shadow-[0_18px_50px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95 dark:shadow-black/30">
    <CardHeader className="gap-4 border-b px-7 py-6">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950"><Flame className="size-5" /></span><div><p className="font-semibold tracking-tight">Olym</p><p className="text-xs text-muted-foreground">Self-hosted deployment platform</p></div></div>
      <div className="space-y-1.5"><CardTitle className="flex items-center gap-2 text-xl font-semibold">{setup ? <ShieldCheck className="size-5 text-[#f54900]" /> : <LockKeyhole className="size-5 text-[#f54900]" />}{mode ? setup ? "Create your admin account" : "Welcome back" : "Checking your installation"}</CardTitle><CardDescription>{mode ? setup ? "Set up the single administrator account for this Olym installation." : "Sign in to manage your applications and infrastructure." : "Determining whether this installation needs an admin account…"}</CardDescription></div>
    </CardHeader>
    <CardContent className="px-7 py-6">
      {!mode ? <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-[#f54900]" />Loading authentication status…</div> : <form className="space-y-5" onSubmit={submit}>
        {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
        {setup && <div className="space-y-2"><Label htmlFor="instance-name">Instance name</Label><Input id="instance-name" name="instanceName" type="text" autoComplete="organization" placeholder="Acme Infra" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} disabled={submitting} required maxLength={80} className="h-10" /><p className="text-xs text-muted-foreground">Shown across this Olym installation.</p></div>}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="admin@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required className="h-10" /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} required minLength={8} className="h-10" />{setup && <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>}</div>
        <Button type="submit" disabled={submitting} className="h-10 w-full bg-gradient-to-r from-[#f54900] to-amber-500 text-white shadow-sm hover:opacity-90">{submitting ? <><LoaderCircle className="size-4 animate-spin" />{setup ? "Creating account…" : "Signing in…"}</> : setup ? "Create account" : "Sign in"}</Button>
        <p className="text-center text-xs text-muted-foreground">{setup ? "This is the only admin account for this installation." : "Access is limited to this installation's administrator."}</p>
      </form>}
    </CardContent>
  </Card>;
}
