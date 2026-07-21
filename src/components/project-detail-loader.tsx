"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { ProjectDetail } from "@/components/project-detail";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";

export function ProjectDetailLoader({ slug }: { slug: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { data?: Project[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load project");
        const match = body.data?.find((item) => item.slug === slug);
        if (!match) throw new Error("Project not found");
        if (!cancelled) setProject(match);
      })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load project"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div className="flex min-h-[calc(100svh-136px)] items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading project…</div>;
  if (error || !project) return <div className="flex min-h-[calc(100svh-136px)] flex-col items-center justify-center gap-4 text-center"><div><h1 className="font-semibold">Project unavailable</h1><p className="mt-1 text-sm text-muted-foreground">{error ?? "Project not found"}</p></div><Button asChild variant="outline"><Link href="/projects">Back to projects</Link></Button></div>;
  return <ProjectDetail project={project} />;
}
