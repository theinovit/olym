"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Flame, FolderKanban, Globe, House, LogOut, Plus, Rocket, Server, Settings, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Home", href: "/home", icon: House },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Deployments", href: "/deployments", icon: Rocket },
  { label: "Servers", href: "/servers", icon: Server },
  { label: "Monitoring", href: "/monitoring", icon: Activity },
  { label: "Domains", href: "/domains", icon: Globe },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function DashboardChrome() {
  const pathname = usePathname();

  return <TooltipProvider>
    <div className="chrome-logo fixed z-40 flex h-12 items-center gap-2 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 pr-2 shadow-md backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
      <Link href="/home" className="flex items-center gap-2 rounded-xl px-1.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Flame className="size-4" /></span>
        <span className="text-sm font-semibold tracking-tight">Olym</span>
      </Link>
      <span className="h-6 w-px bg-border" />
      <ThemeToggle />
    </div>

    <nav aria-label="Primary navigation" className="chrome-rail fixed z-40 flex w-12 flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-md backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
      {navigation.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Tooltip key={item.href}><TooltipTrigger asChild><Button asChild variant="ghost" size="icon" data-active={active} className={cn("chrome-nav-item size-9 rounded-xl text-muted-foreground", active && "text-foreground")}><Link href={item.href} aria-label={item.label}><item.icon className="size-4" /></Link></Button></TooltipTrigger><TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent></Tooltip>;
      })}
      <span className="my-1 h-px w-7 bg-border" />
      <Tooltip><TooltipTrigger asChild><Button asChild size="icon" className="chrome-new-project size-9 rounded-xl text-white shadow-sm hover:opacity-90"><Link href="/projects/new" aria-label="New Project"><Plus className="size-4" /></Link></Button></TooltipTrigger><TooltipContent side="right" sideOffset={8}>New Project</TooltipContent></Tooltip>
    </nav>

    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" className="chrome-account fixed z-40 size-12 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-md backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95"><Avatar className="size-9"><AvatarFallback className="bg-neutral-950 text-xs text-white dark:bg-white dark:text-neutral-950">RS</AvatarFallback></Avatar><span className="sr-only">Open account menu</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-56 rounded-xl">
        <DropdownMenuLabel><span className="block text-sm text-foreground">Rodrigo Silverio</span><span className="block font-normal">rodrigo@acme.com</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem><UserRound />Account</DropdownMenuItem>
        <DropdownMenuItem variant="destructive"><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TooltipProvider>;
}
