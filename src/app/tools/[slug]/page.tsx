import React from "react";
import { notFound } from "next/navigation";
import { GENERAL_AI_TOOLS, getGeneralAiTool } from "@/lib/ai-tools-config";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { AiToolWorkbench } from "@/components/ai-tool-workbench";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getGeneralAiTool(slug);
  if (!tool) return {};
  return buildPublicPageMetadata({
    title: tool.titleVi,
    description: tool.descriptionVi,
    pathname: `/tools/${tool.slug}`,
    type: "website",
  });
}

export default async function DynamicAiToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getGeneralAiTool(slug);
  if (!tool) notFound();

  const summaryList = GENERAL_AI_TOOLS.map((t) => ({
    slug: t.slug,
    titleVi: t.titleVi,
    titleEn: t.titleEn,
  }));

  return <AiToolWorkbench tool={tool} allTools={summaryList} />;
}
