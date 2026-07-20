import { notFound } from "next/navigation";

import { ProjectDetail } from "@/components/project-detail";
import { mockProjects } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockProjects.map((project) => ({ slug: project.slug }));
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ new?: string; description?: string; server?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const project = mockProjects.find((item) => item.slug === slug) ?? (query.new === "1" ? {
    id: `draft_${slug}`,
    name: slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    slug,
    description: query.description ?? "New project canvas",
    serverId: query.server ?? "srv_01",
    createdAt: new Date().toISOString(),
  } : undefined);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
