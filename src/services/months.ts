import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { canHardDeleteMonth } from "@/lib/rbac";
import { slugifyMonth } from "@/lib/names";
import { parseMonthLabel } from "@/lib/schedule-calendar";
import { seedScheduleSlotsForMonth } from "@/services/schedule-calendar";

export async function listMonths(includeArchived = false) {
  return prisma.month.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { createdAt: "desc" }
  });
}

export async function getMonthBySlug(slug: string) {
  return prisma.month.findUnique({ where: { slug } });
}

export async function createMonth(params: {
  name: string;
  year?: number;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const parsed = parseMonthLabel(params.name, params.year);
  const slug = slugifyMonth(parsed.displayName);
  const existing = await prisma.month.findUnique({ where: { slug } });
  if (existing) throw new Error("A month with this name already exists");

  const month = await prisma.month.create({
    data: {
      name: parsed.displayName,
      slug,
      year: parsed.year
    }
  });

  await seedScheduleSlotsForMonth(month.id, month);

  await writeAuditLog({
    userId: params.actorUserId,
    action: "month.create",
    entityType: "month",
    entityId: month.id,
    payload: { name: parsed.displayName, year: parsed.year, slug },
    ipAddress: params.ipAddress
  });

  return month;
}

export async function setActiveMonth(params: {
  slug: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const month = await prisma.month.findUnique({ where: { slug: params.slug } });
  if (!month || month.archivedAt) throw new Error("Month not found");

  await prisma.$transaction([
    prisma.month.updateMany({ data: { isActive: false }, where: { isActive: true } }),
    prisma.month.update({ where: { id: month.id }, data: { isActive: true } }),
    prisma.appSetting.upsert({
      where: { key: "active_month_slug" },
      create: { key: "active_month_slug", value: month.slug },
      update: { value: month.slug }
    })
  ]);

  await writeAuditLog({
    userId: params.actorUserId,
    action: "month.set_active",
    entityType: "month",
    entityId: month.id,
    ipAddress: params.ipAddress
  });

  return month;
}

export async function archiveMonth(params: {
  slug: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const month = await prisma.month.findUnique({ where: { slug: params.slug } });
  if (!month) throw new Error("Month not found");

  const updated = await prisma.month.update({
    where: { id: month.id },
    data: { archivedAt: new Date(), isActive: false }
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "month.archive",
    entityType: "month",
    entityId: month.id,
    ipAddress: params.ipAddress
  });

  return updated;
}

export async function hardDeleteMonth(params: {
  slug: string;
  reason: string;
  actorUserId: string;
  actorRole: import("@prisma/client").UserRole;
  ipAddress?: string | null;
}) {
  if (!canHardDeleteMonth(params.actorRole)) {
    throw new Error("Only adm or management can hard delete a month");
  }
  const month = await prisma.month.findUnique({ where: { slug: params.slug } });
  if (!month) throw new Error("Month not found");

  await prisma.month.delete({ where: { id: month.id } });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "month.hard_delete",
    entityType: "month",
    entityId: month.id,
    payload: { name: month.name, reason: params.reason },
    ipAddress: params.ipAddress
  });
}
