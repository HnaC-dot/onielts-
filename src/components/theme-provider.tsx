"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark" | "system";
}) {
  return (
    <NextThemesProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
      {children}
    </NextThemesProvider>
  );
}
