import type { Metadata } from "next";

import { AuthForm } from "@/components/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in · Olym",
};

export default function LoginPage() {
  return <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-neutral-50 px-5 py-12 text-foreground dark:bg-neutral-950">
    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(rgba(163,163,163,.2)_1px,transparent_1px)] bg-size-[20px_20px] dark:bg-[radial-gradient(rgba(82,82,82,.24)_1px,transparent_1px)]" />
    <div aria-hidden="true" className="absolute top-[-180px] left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-orange-500/8 blur-3xl dark:bg-orange-500/6" />
    <div className="absolute top-5 right-5 z-10 rounded-xl border border-neutral-200 bg-white/90 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90"><ThemeToggle /></div>
    <div className="relative z-10 flex w-full justify-center"><AuthForm /></div>
  </main>;
}
