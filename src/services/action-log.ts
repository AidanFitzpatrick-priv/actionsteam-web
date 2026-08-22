import { ActionLogResult, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { canDeleteActionLog, canViewAllActionLogs, shouldShowOnGoalTracker } from "@/lib/rbac";
import { londonDayRangeUtc } from "@/lib/dates";
import { getDropdownOptions } from "@/services/reference-data";

export type ActionLogDto = {
  id: string;
  createdAt: string;
  orgName: string;
  actionText: string;
  result: ActionLogResult;
  positiveNumber: number | null;
  negativeReason: string | null;
  proofUrl: string;
  userId: string;
  staffName: string;
  cityId: string | null;
  canDelete: boolean;
};

export type DailyGoalRow = {
  staffName: string;
  met: boolean;
};

export type DailyGoalStatus = {
  date: string;
  rows: DailyGoalRow[];
  metCount: number;
  total: number;
};

export type ActionLogInput = {
  orgName: string;
  actionText: string;
  result: "positive" | "negative";
  positiveNumber?: number | null;
  negativeReason?: string | null;
  proofUrl: string;
};

export type NormalizedActionLog = {
  orgName: string;
  actionText: string;
  result: ActionLogResult;
  positiveNumber: number | null;
  negativeReason: string | null;
  proofUrl: string;
};

const PROOF_URL = /^https?:\/\/.+/i;

export function normalizeActionLogFields(
  input: ActionLogInput
): { ok: true; value: NormalizedActionLog } | { ok: false; error: string } {
  const orgName = String(input.orgName ?? "").trim();
  if (!orgName) return { ok: false, error: "Organisation is required" };

  const actionText = String(input.actionText ?? "").trim();
  if (!actionText) return { ok: false, error: "Action is required" };
  if (actionText.length > 500) return { ok: false, error: "Action is too long" };

  const result = input.result;
  if (result !== "positive" && result !== "negative") {
    return { ok: false, error: "Result must be positive or negative" };
  }

  const proofUrl = String(input.proofUrl ?? "").trim();
  if (!proofUrl) return { ok: false, error: "Proof is required" };
  if (proofUrl.length > 2000) return { ok: false, error: "Proof link is too long" };
  try {
    const parsed = new URL(proofUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Proof must be a http(s) link" };
    }
  } catch {
    return { ok: false, error: "Proof must be a valid link" };
  }
  if (!PROOF_URL.test(proofUrl)) {
    return { ok: false, error: "Proof must be a http(s) link" };
  }

  if (result === "positive") {
    const n = input.positiveNumber;
    if (n == null || typeof n !== "number" || !Number.isFinite(n)) {
      return { ok: false, error: "Enter the action/numbers" };
    }
    return {
      ok: true,
      value: {
        orgName,
        actionText,
        result: "positive",
        positiveNumber: n,
        negativeReason: null,
        proofUrl
      }
    };
  }

  const negativeReason = String(input.negativeReason ?? "").trim();
  if (!negativeReason) return { ok: false, error: "Explain why" };
  if (negativeReason.length > 1000) return { ok: false, error: "Explanation is too long" };

  return {
    ok: true,
    value: {
      orgName,
      actionText,
      result: "negative",
      positiveNumber: null,
      negativeReason,
      proofUrl
    }
  };
}

function toDto(
  row: {
    id: string;
    createdAt: Date;
    orgName: string;
    actionText: string;
    result: ActionLogResult;
    positiveNumber: number | null;
    negativeReason: string | null;
    proofUrl: string;
    userId: string;
    user: { username: string; cityId: string | null };
  },
  actor: { id: string; role: UserRole }
): ActionLogDto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    orgName: row.orgName,
    actionText: row.actionText,
    result: row.result,
    positiveNumber: row.positiveNumber,
    negativeReason: row.negativeReason,
    proofUrl: row.proofUrl,
    userId: row.userId,
    staffName: row.user.username,
    cityId: row.user.cityId,
    canDelete: canDeleteActionLog(actor, row.userId)
  };
}

const logInclude = { user: { select: { username: true, cityId: true } } } as const;

export async function listActionLogsForViewer(actor: { id: string; role: UserRole }): Promise<{
  orgOptions: string[];
  logs: ActionLogDto[];
  isAuxPlus: boolean;
  viewerId: string;
  dailyGoal: DailyGoalStatus | null;
}> {
  const isAuxPlus = canViewAllActionLogs(actor.role);
  const [dropdowns, rows] = await Promise.all([
    getDropdownOptions({ typeKind: "action" }),
    prisma.actionLog.findMany({
      where: {
        deletedAt: null,
        ...(isAuxPlus ? {} : { userId: actor.id })
      },
      include: logInclude,
      orderBy: { createdAt: "desc" },
      take: 200
    })
  ]);

  return {
    orgOptions: dropdowns.org1,
    logs: rows.map(r => toDto(r, actor)),
    isAuxPlus,
    viewerId: actor.id,
    dailyGoal: isAuxPlus ? await getDailyGoalStatus() : null
  };
}

export async function createActionLog(params: {
  actor: { id: string; role: UserRole };
  input: ActionLogInput;
}): Promise<ActionLogDto> {
  const parsed = normalizeActionLogFields(params.input);
  if (!parsed.ok) throw new ApiError(400, parsed.error);

  const dropdowns = await getDropdownOptions({ typeKind: "action" });
  if (!dropdowns.org1.includes(parsed.value.orgName)) {
    throw new ApiError(400, "Organisation is not valid");
  }

  const row = await prisma.actionLog.create({
    data: {
      userId: params.actor.id,
      orgName: parsed.value.orgName,
      actionText: parsed.value.actionText,
      result: parsed.value.result,
      positiveNumber: parsed.value.positiveNumber,
      negativeReason: parsed.value.negativeReason,
      proofUrl: parsed.value.proofUrl
    },
    include: logInclude
  });

  return toDto(row, params.actor);
}

export async function softDeleteActionLog(params: {
  actor: { id: string; role: UserRole };
  logId: string;
}): Promise<void> {
  const row = await prisma.actionLog.findUnique({
    where: { id: params.logId },
    select: { id: true, userId: true, deletedAt: true }
  });
  if (!row || row.deletedAt) throw new ApiError(404, "Log not found");
  if (!canDeleteActionLog(params.actor, row.userId)) {
    throw new ApiError(403, "Insufficient permissions");
  }

  await prisma.actionLog.update({
    where: { id: row.id },
    data: { deletedAt: new Date() }
  });
}

export function buildDailyGoalRows(
  users: { username: string; role: UserRole; hiddenFromGoalTrackers: boolean }[],
  loggedUsernames: Set<string>
): DailyGoalRow[] {
  return users
    .filter(u => shouldShowOnGoalTracker(u.role, u.hiddenFromGoalTrackers))
    .map(u => ({
      staffName: u.username,
      met: loggedUsernames.has(u.username)
    }))
    .sort((a, b) => {
      if (a.met !== b.met) return a.met ? -1 : 1;
      return a.staffName.localeCompare(b.staffName, undefined, { sensitivity: "base" });
    });
}

export async function getDailyGoalStatus(now = new Date()): Promise<DailyGoalStatus> {
  const { start, end, ymd } = londonDayRangeUtc(now);
  const [users, logs] = await Promise.all([
    prisma.user.findMany({
      where: { disabledAt: null },
      select: { username: true, role: true, hiddenFromGoalTrackers: true }
    }),
    prisma.actionLog.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: start, lt: end }
      },
      select: { user: { select: { username: true } } }
    })
  ]);

  const loggedUsernames = new Set(logs.map(l => l.user.username));
  const rows = buildDailyGoalRows(users, loggedUsernames);
  const metCount = rows.filter(r => r.met).length;

  return {
    date: ymd,
    rows,
    metCount,
    total: rows.length
  };
}
