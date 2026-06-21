import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { slugifyMonth } from "@/lib/names";
import { SCHEDULE } from "@/lib/config";

export async function listMonths(includeArchived = false) {
  return prisma.month.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { createdAt: "desc" }
  });
}

export async function getMonthBySlug(slug: string) {
  return prisma.month.findUnique({ where: { slug } });
}

async function seedScheduleSlots(monthId: string) {
  const slots: {
    monthId: string;
    weekIndex: number;
    dayIndex: number;
    rowIndex: number;
  }[] = [];

  for (let w = 0; w < SCHEDULE.WEEKS_DEFAULT; w++) {
    for (let d = 0; d < SCHEDULE.DAYS_PER_WEEK; d++) {
      for (let r = 0; r < SCHEDULE.DATA_ROWS; r++) {
        slots.push({ monthId, weekIndex: w, dayIndex: d, rowIndex: r });
      }
    }
  }

  await prisma.scheduleSlot.createMany({ data: slots, skipDuplicates: true });
}

export async function createMonth(params: {
  name: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const name = params.name.trim();
  if (!name) throw new Error("Month name is required");

  const slug = slugifyMonth(name);
  const existing = await prisma.month.findUnique({ where: { slug } });
  if (existing) throw new Error("A month with this name already exists");

  const month = await prisma.month.create({
    data: { name, slug }
  });

  await seedScheduleSlots(month.id);

  await writeAuditLog({
    userId: params.actorUserId,
    action: "month.create",
    entityType: "month",
    entityId: month.id,
    payload: { name, slug },
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
  ipAddress?: string | null;
}) {
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
