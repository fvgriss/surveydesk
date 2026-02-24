import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token (important for server components)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  // Allow public routes: login, signup, proposal acceptance, API webhooks
  const isPublicRoute =
    request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/landing.html" || request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth/callback") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname.startsWith("/accept/") ||
    request.nextUrl.pathname.startsWith("/api/retell") ||
    request.nextUrl.pathname.startsWith("/api/gmail/callback") ||
    request.nextUrl.pathname.startsWith("/api/stripe") ||
    request.nextUrl.pathname.startsWith("/api/onboarding") ||
    request.nextUrl.pathname.startsWith("/api/signup") ||
    request.nextUrl.pathname.startsWith("/setup-forwarding");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login/signup
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Trial / subscription enforcement ───────────────────────
  // If the user is logged in and hitting a protected dashboard route,
  // check whether their trial has expired (and they haven't paid).
  // Allow: subscription page (so they can pay), onboarding, API routes, admin.
  const isTrialExempt =
    request.nextUrl.pathname.startsWith("/subscription") ||
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/setup-forwarding");

  // Skip trial enforcement for super admins impersonating a tenant
  const isImpersonating = request.cookies.has("impersonate_tenant");

  if (user && !isPublicRoute && !isTrialExempt && !isImpersonating) {
    // Look up the user's tenant subscription status via Supabase (Edge-safe)
    const { data: dbUser } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .limit(1)
      .single();

    if (dbUser?.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("subscription_status, trial_ends_at")
        .eq("id", dbUser.tenant_id)
        .limit(1)
        .single();

      if (tenant) {
        const status = tenant.subscription_status || "trialing";
        const trialEndsAt = tenant.trial_ends_at
          ? new Date(tenant.trial_ends_at)
          : null;
        const now = new Date();

        const isExpired =
          (status === "trialing" && trialEndsAt && trialEndsAt < now) ||
          status === "canceled";

        if (isExpired) {
          const url = request.nextUrl.clone();
          url.pathname = "/subscription";
          url.searchParams.set("expired", "true");
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
