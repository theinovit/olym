import { notFound } from "next/navigation";

import { ProjectDetail } from "@/components/project-detail";
import { mockProjects } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockProjects.map((project) => ({ slug: project.slug }));
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = mockProjects.find((item) => item.slug === slug);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
