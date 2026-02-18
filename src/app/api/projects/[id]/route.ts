import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, contacts, invoices, fieldVisits, crews, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// GET /api/projects/[id] — single project with related data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, id), eq(projects.tenantId, tenant.tenantId))
    )
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

// PATCH /api/projects/[id] — update status, toggle task, update notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify project belongs to tenant
  const [existing] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, id), eq(projects.tenantId, tenant.tenantId))
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const updateFields: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  // Handle status change with timestamp logic
  if (body.status && body.status !== existing.status) {
    updateFields.status = body.status;
    const now = new Date();

    switch (body.status) {
      case "in_progress":
        if (!existing.startedAt) updateFields.startedAt = now;
        break;
      case "field_complete":
        updateFields.fieldCompletedAt = now;
        break;
      case "delivered":
        updateFields.deliveredAt = now;
        break;
      case "closed":
        updateFields.closedAt = now;
        break;
    }
  }

  // Handle task checklist toggle
  if (body.toggleTaskIndex !== undefined) {
    const idx = body.toggleTaskIndex as number;
    const checklist = (existing.taskChecklist || []) as Array<{
      task: string;
      description: string;
      completed: boolean;
      completedAt?: string;
    }>;

    if (idx >= 0 && idx < checklist.length) {
      checklist[idx] = {
        ...checklist[idx],
        completed: !checklist[idx].completed,
        completedAt: !checklist[idx].completed
          ? new Date().toISOString()
          : undefined,
      };
      updateFields.taskChecklist = checklist;
    }
  }

  // Handle notes update
  if (body.notes !== undefined) {
    updateFields.notes = body.notes;
  }

  const [updated] = await db
    .update(projects)
    .set(updateFields)
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json(updated);
}
