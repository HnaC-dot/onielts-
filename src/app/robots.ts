import type { MetadataRoute } from "next";
import { getSiteSeoSettings } from "@/lib/site-content";
import { buildRobotsConfig } from "@/lib/seo-cms-shared";
import { getAppBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSiteSeoSettings();
  return buildRobotsConfig(seo, getAppBaseUrl());
}
