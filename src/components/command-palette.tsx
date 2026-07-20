"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, FolderKanban, Globe, House, Plus, Rocket, Search, Server, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { mockProjects } from "@/lib/mock-data";

const pages = [
  { label: "Home", href: "/home", icon: House },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Deployments", href: "/deployments", icon: Rocket },
  { label: "Servers", href: "/servers", icon: Server },
  { label: "Monitoring", href: "/monitoring", icon: Activity },
  { label: "Domains", href: "/domains", icon: Globe },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="chrome-command fixed z-40 h-11 gap-2 rounded-2xl border-neutral-200 bg-white/95 px-3 text-muted-foreground shadow-md backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95" onClick={() => setOpen(true)}>
        <Search className="size-3.5" /><span className="hidden sm:inline">Search</span><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} className="sm:max-w-lg">
        <Command>
          <CommandInput placeholder="Search pages and projects…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/projects/new")}><Plus />New Project<CommandShortcut>Action</CommandShortcut></CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {pages.map((page) => <CommandItem key={page.href} onSelect={() => go(page.href)}><page.icon />{page.label}</CommandItem>)}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {mockProjects.map((project) => <CommandItem key={project.id} value={`${project.name} ${project.description ?? ""}`} onSelect={() => go(`/projects/${project.slug}`)}><FolderKanban />{project.name}</CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
