import type { RequestUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function writeAuditLog(input: {
  user: RequestUser | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  details?: unknown;
}) {
  type DetailsType = Parameters<typeof prisma.auditLog.create>[0]["data"]["details"];
  await prisma.auditLog.create({
    data: {
      userId: input.user?.id ?? null,
      action: input.action,
      targetTable: input.targetTable ?? null,
      targetId: input.targetId ?? null,
      details: input.details as DetailsType
    }
  });
}
