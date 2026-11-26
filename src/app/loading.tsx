import React from "react";
import { PageSkeleton } from "@/components/route-state-ui";

export default function RootLoading() {
  return <PageSkeleton cards={3} />;
}
