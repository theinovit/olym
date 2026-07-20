import { DashboardChrome } from "@/components/dashboard-chrome";
import { CommandPalette } from "@/components/command-palette";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dashboard-grid min-h-svh bg-neutral-50 text-foreground dark:bg-neutral-950">
      <style>{`.dashboard-grid { background-image: radial-gradient(rgba(163,163,163,.16) 1px, transparent 1px); background-size: 20px 20px; } .dark .dashboard-grid { background-image: radial-gradient(rgba(82,82,82,.18) 1px, transparent 1px); } .dashboard-content { min-height: 100svh; padding: 96px 24px 40px 96px; } .dashboard-content [data-slot="card"] { border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.06); } .dark .dashboard-content [data-slot="card"] { box-shadow: 0 10px 28px rgba(0,0,0,.24); } .chrome-logo, .chrome-rail, .chrome-account, .chrome-command { z-index: 40; } .chrome-logo { top: 16px; left: 16px; height: 48px; } .chrome-rail { top: 96px; left: 16px; width: 48px; padding: 6px; } .chrome-account { bottom: 16px; left: 16px; width: 48px; height: 48px; } .chrome-command { top: 16px; right: 16px; height: 44px; } .chrome-nav-item[data-active="true"] { background: rgba(245,245,245,.95); color: #171717; box-shadow: 0 1px 2px rgba(0,0,0,.06); } .dark .chrome-nav-item[data-active="true"] { background: rgba(64,64,64,.9); color: #fafafa; } .chrome-new-project { background: linear-gradient(135deg, #ea580c, #f59e0b) !important; color: white !important; } @media (max-width: 640px) { .dashboard-content { padding: 84px 16px 84px 80px; } .chrome-logo { top: 12px; left: 12px; } .chrome-rail { top: 80px; left: 12px; } .chrome-account { bottom: 12px; left: 12px; } .chrome-command { top: 12px; right: 12px; } }`}</style>
      <DashboardChrome />
      <CommandPalette />
      <main className="dashboard-content">{children}</main>
    </div>
  );
}
