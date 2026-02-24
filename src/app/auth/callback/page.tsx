"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();
      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/dashboard";

      // PKCE flow: exchange code for session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.push(next);
          return;
        }
      }

      // Implicit flow: read tokens from hash fragment (used by recovery/invite links)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            const type = params.get("type");
            // Recovery/invite flow → set password first
            if (type === "recovery") {
              router.push("/auth/set-password");
              return;
            }
            router.push(next);
            return;
          }
        }
      }

      setError(true);
      setTimeout(() => router.push("/login?error=auth_callback_failed"), 2000);
    }

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">Authentication failed. Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-500">Signing in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-gray-500">Signing in...</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
