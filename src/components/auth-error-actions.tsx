"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthErrorActionsProps {
  isEn?: boolean;
  showLogout?: boolean;
  retryLabel?: string;
}

export function AuthErrorActions({
  isEn = false,
  showLogout = false,
  retryLabel,
}: AuthErrorActionsProps) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      router.push("/auth");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
      <Button
        type="button"
        onClick={handleRetry}
        disabled={retrying || signingOut}
      >
        <RefreshCw
          className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`}
        />
        {retryLabel ?? (isEn ? "Retry" : "Thử tải lại")}
      </Button>
      {showLogout && (
        <Button
          type="button"
          variant="outline"
          onClick={handleSignOut}
          disabled={retrying || signingOut}
        >
          <LogOut className="h-4 w-4" />
          {isEn ? "Sign out" : "Đăng xuất"}
        </Button>
      )}
    </div>
  );
}
