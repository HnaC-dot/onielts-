import React from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function MentorFloatingButton() {
  return (
    <Link
      href="/mentor"
      aria-label="Mentor Ôn IELTS"
      className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-emerald-700 hover:scale-[1.02]"
    >
      <GraduationCap className="h-4 w-4" />
      <span className="hidden sm:inline">Mentor Ôn IELTS</span>
    </Link>
  );
}
