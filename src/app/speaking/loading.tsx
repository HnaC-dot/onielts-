import React from "react";
import { PageSkeleton } from "@/components/route-state-ui";

export default function SpeakingLoading() {
  return <PageSkeleton cards={2} columns="lg:grid-cols-2" />;
}
