"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Flame,
  FolderKanban,
  Globe,
  House,
  Plus,
  Rocket,
  Server,
  Settings,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const navGroups = [
  {
    label: "Main",
    items: [
      { title: "Home", href: "/home", icon: House },
      { title: "Projects", href: "/projects", icon: FolderKanban },
      { title: "Deployments", href: "/deployments", icon: Rocket },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
  {
    label: "Infrastructure",
    items: [
      { title: "Servers", href: "/servers", icon: Server },
      { title: "Monitoring", href: "/monitoring", icon: Activity },
      { title: "Domains", href: "/domains", icon: Globe },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flame className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Hefesto
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`)
                      }
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <Button
              asChild
              className="w-full bg-linear-to-r from-violet-600 to-blue-600 text-white hover:opacity-90"
            >
              <Link href="/projects/new">
                <Plus className="size-4" />
                New Project
              </Link>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">
                  RS
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Rodrigo Silverio</span>
                <span className="truncate text-xs text-muted-foreground">
                  rodrigo@acme.com
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
