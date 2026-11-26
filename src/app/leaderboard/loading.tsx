import React from "react";
import { PageSkeleton } from "@/components/route-state-ui";

export default function LeaderboardLoading() {
  return <PageSkeleton cards={2} columns="grid-cols-1" />;
}
