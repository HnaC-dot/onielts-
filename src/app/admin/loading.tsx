import React from "react";
import { PageSkeleton } from "@/components/route-state-ui";

export default function AdminLoading() {
  return <PageSkeleton cards={4} columns="sm:grid-cols-2 lg:grid-cols-4" />;
}
