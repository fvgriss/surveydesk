import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants, crews, integrations, users } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  if (["crew_chief", "instrument_person"].includes(tenant.role)) redirect("/schedule");

  const [firm] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId))
    .limit(1);

  if (!firm) redirect("/login");

  // Fetch Gmail integration status
  const [gmailIntegration] = await db
    .select({
      accountEmail: integrations.accountEmail,
      isActive: integrations.isActive,
      lastSyncAt: integrations.lastSyncAt,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenant.tenantId),
        eq(integrations.provider, "gmail")
      )
    )
    .limit(1);

  // Fetch current user's notification prefs
  const [currentUser] = await db
    .select({
      smsNotifications: users.smsNotifications,
      emailNotifications: users.emailNotifications,
    })
    .from(users)
    .where(eq(users.id, tenant.userId))
    .limit(1);

  const crewRows = await db
    .select({
      id: crews.id,
      name: crews.name,
      chiefName: crews.chiefName,
      isActive: crews.isActive,
      notes: crews.notes,
      createdAt: crews.createdAt,
    })
    .from(crews)
    .where(eq(crews.tenantId, tenant.tenantId))
    .orderBy(desc(crews.createdAt));

  const teamMembers = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      emailNotifications: users.emailNotifications,
      smsNotifications: users.smsNotifications,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenant.tenantId))
    .orderBy(asc(users.createdAt));

  return (
    <SettingsClient
      firm={{
        ...firm,
        createdAt: firm.createdAt.toISOString(),
        updatedAt: firm.updatedAt.toISOString(),
      }}
      crews={crewRows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }))}
      teamMembers={teamMembers.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))}
      userRole={tenant.role}
      gmail={
        gmailIntegration
          ? {
              accountEmail: gmailIntegration.accountEmail || "",
              isActive: gmailIntegration.isActive,
              lastSyncAt: gmailIntegration.lastSyncAt?.toISOString() || null,
            }
          : null
      }
      retellPhone={firm.retellPhoneNumber || null}
      subscriptionStatus={firm.subscriptionStatus || "trialing"}
      notificationPrefs={{
        smsNotifications: currentUser?.smsNotifications ?? true,
        emailNotifications: currentUser?.emailNotifications ?? true,
      }}
    />
  );
}
