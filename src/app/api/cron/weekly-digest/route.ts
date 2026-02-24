import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users, leads, proposals, fieldVisits, invoices, payments } from "@/db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * GET /api/cron/weekly-digest
 *
 * Sends a weekly summary email to each tenant's owner.
 * Triggered by Vercel Cron every Monday at 8am ET (1pm UTC).
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active/trialing tenants
    const activeTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        subscriptionStatus: tenants.subscriptionStatus,
      })
      .from(tenants)
      .where(
        inArray(tenants.subscriptionStatus, ["active", "trialing"])
      );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekEnd = now;
    const nextWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Format date range for display
    const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    const weekLabel = `${dateFormatter.format(weekAgo)} – ${dateFormatter.format(weekEnd)}`;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tenant of activeTenants) {
      try {
        // Find the owner
        const [owner] = await db
          .select({ email: users.email, fullName: users.fullName, emailNotifications: users.emailNotifications })
          .from(users)
          .where(and(eq(users.tenantId, tenant.id), eq(users.role, "owner")))
          .limit(1);

        if (!owner?.email || !owner.emailNotifications) {
          skipped++;
          continue;
        }

        // Query stats for the past week
        const [stats] = await db
          .select({
            newLeads: sql<number>`count(*)`.as("new_leads"),
          })
          .from(leads)
          .where(
            and(eq(leads.tenantId, tenant.id), gte(leads.createdAt, weekAgo))
          );

        // Top 3 leads
        const topLeads = await db
          .select({
            propertyAddress: leads.propertyAddress,
            surveyType: leads.surveyType,
            urgency: leads.urgency,
          })
          .from(leads)
          .where(
            and(eq(leads.tenantId, tenant.id), gte(leads.createdAt, weekAgo))
          )
          .orderBy(leads.createdAt)
          .limit(3);

        // Proposals sent
        const [proposalStats] = await db
          .select({
            sent: sql<number>`count(*) filter (where ${proposals.sentAt} >= ${weekAgo})`,
            accepted: sql<number>`count(*) filter (where ${proposals.acceptedAt} >= ${weekAgo})`,
            acceptedValue: sql<string>`coalesce(sum(${proposals.total}) filter (where ${proposals.acceptedAt} >= ${weekAgo}), '0')`,
          })
          .from(proposals)
          .where(eq(proposals.tenantId, tenant.id));

        // Field visits completed
        const [visitStats] = await db
          .select({
            completed: sql<number>`count(*) filter (where ${fieldVisits.status} = 'completed' and ${fieldVisits.updatedAt} >= ${weekAgo})`,
          })
          .from(fieldVisits)
          .where(eq(fieldVisits.tenantId, tenant.id));

        // Upcoming visits (next 7 days)
        const [upcomingStats] = await db
          .select({
            upcoming: sql<number>`count(*)`,
          })
          .from(fieldVisits)
          .where(
            and(
              eq(fieldVisits.tenantId, tenant.id),
              gte(fieldVisits.scheduledDate, now.toISOString().split("T")[0]),
              lte(fieldVisits.scheduledDate, nextWeekEnd.toISOString().split("T")[0]),
              sql`${fieldVisits.scheduledDate} != '1970-01-01'`
            )
          );

        // Payments received
        const [paymentStats] = await db
          .select({
            count: sql<number>`count(*)`,
            total: sql<string>`coalesce(sum(${payments.amount}), '0')`,
          })
          .from(payments)
          .where(
            and(eq(payments.tenantId, tenant.id), gte(payments.receivedAt, weekAgo))
          );

        // Outstanding invoices
        const [outstandingStats] = await db
          .select({
            count: sql<number>`count(*)`,
            total: sql<string>`coalesce(sum(${invoices.total}), '0')`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenant.id),
              inArray(invoices.status, ["sent", "viewed", "partially_paid", "overdue"])
            )
          );

        const leadCount = Number(stats.newLeads);
        const proposalsSent = Number(proposalStats.sent);
        const proposalsAccepted = Number(proposalStats.accepted);
        const acceptedValue = parseFloat(proposalStats.acceptedValue);
        const visitsCompleted = Number(visitStats.completed);
        const upcomingVisits = Number(upcomingStats.upcoming);
        const paymentsReceived = Number(paymentStats.count);
        const paymentsTotal = parseFloat(paymentStats.total);
        const outstandingCount = Number(outstandingStats.count);
        const outstandingTotal = parseFloat(outstandingStats.total);

        // Skip if literally nothing happened
        if (leadCount === 0 && proposalsSent === 0 && visitsCompleted === 0 && paymentsReceived === 0) {
          skipped++;
          continue;
        }

        const firstName = owner.fullName?.split(" ")[0] || "there";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app";
        const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

        const leadRows = topLeads
          .map((l) => `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#374151;">${l.propertyAddress}</td><td style="padding:4px 0;font-size:13px;color:#6b7280;">${(l.surveyType || "").replace(/_/g, " ")}</td></tr>`)
          .join("");

        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#1e293b;color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;font-size:18px;font-weight:600;">Your week in review</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">${tenant.name} &middot; ${weekLabel}</p>
            </div>
            <div style="background:white;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 20px;font-size:14px;color:#374151;">Hi ${firstName}, here&rsquo;s what happened this week:</p>

              ${leadCount > 0 ? `
              <div style="margin-bottom:20px;">
                <h2 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1e293b;">New Leads &mdash; ${leadCount}</h2>
                ${topLeads.length > 0 ? `<table style="border-collapse:collapse;width:100%;">${leadRows}</table>` : ""}
              </div>` : ""}

              ${proposalsSent > 0 || proposalsAccepted > 0 ? `
              <div style="margin-bottom:20px;">
                <h2 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Proposals</h2>
                <p style="margin:0;font-size:13px;color:#374151;">
                  ${proposalsSent} sent${proposalsAccepted > 0 ? `, ${proposalsAccepted} accepted (${fmt(acceptedValue)})` : ""}
                </p>
              </div>` : ""}

              <div style="margin-bottom:20px;">
                <h2 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Field Work</h2>
                <p style="margin:0;font-size:13px;color:#374151;">
                  ${visitsCompleted} visit${visitsCompleted !== 1 ? "s" : ""} completed${upcomingVisits > 0 ? ` &middot; ${upcomingVisits} scheduled this week` : ""}
                </p>
              </div>

              ${paymentsReceived > 0 || outstandingCount > 0 ? `
              <div style="margin-bottom:20px;">
                <h2 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Billing</h2>
                <p style="margin:0;font-size:13px;color:#374151;">
                  ${paymentsReceived > 0 ? `${fmt(paymentsTotal)} received` : ""}${paymentsReceived > 0 && outstandingCount > 0 ? " &middot; " : ""}${outstandingCount > 0 ? `${fmt(outstandingTotal)} outstanding (${outstandingCount} invoice${outstandingCount !== 1 ? "s" : ""})` : ""}
                </p>
              </div>` : ""}

              <div style="text-align:center;margin-top:24px;">
                <a href="${appUrl}/dashboard" style="display:inline-block;background:#1e293b;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">View Dashboard &rarr;</a>
              </div>
            </div>
            <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">
              ${tenant.name} &middot; Powered by SurveyOS
            </p>
          </div>
        `;

        await resend.emails.send({
          from: "SurveyOS <onboarding@resend.dev>",
          to: owner.email,
          subject: `Your week in review — ${tenant.name}`,
          html,
        });

        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${tenant.name}: ${msg}`);
        console.error(`[weekly-digest] Failed for ${tenant.name}:`, msg);
      }
    }

    console.log(`[weekly-digest] Sent ${sent}, skipped ${skipped}, errors ${errors.length}`);

    return NextResponse.json({
      sent,
      skipped,
      errors: errors.length,
      total: activeTenants.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[weekly-digest] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
