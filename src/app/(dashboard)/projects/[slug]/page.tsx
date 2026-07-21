import { ProjectDetailLoader } from "@/components/project-detail-loader";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProjectDetailLoader slug={slug} />;
}
