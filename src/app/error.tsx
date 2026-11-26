"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorCard error={error} reset={reset} />;
}
