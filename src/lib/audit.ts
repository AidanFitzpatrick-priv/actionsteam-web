import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function writeAuditLog(params: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      payload: params.payload ?? undefined,
      ipAddress: params.ipAddress ?? null
    }
  });
}
