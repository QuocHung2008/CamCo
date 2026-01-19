import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { canEdit, getUserFromNextRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { zLoanStatusPatch } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const bypass = (process.env.AUTH_BYPASS ?? "").toLowerCase() === "true";
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }
  if (!canEdit(user)) {
    return jsonError(403, { code: "FORBIDDEN", message: "Không có quyền sửa" });
  }

  const body = await req.json().catch(() => null);
  const parsed = zLoanStatusPatch.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const before = await prisma.loan.findFirst({
    where: { id: ctx.params.id, deletedAt: null },
    select: { id: true }
  });
  if (!before) {
    return jsonError(404, { code: "NOT_FOUND", message: "Không tìm thấy phiếu" });
  }

  const items = await prisma.loanItem.findMany({
    where: { loanId: ctx.params.id },
    select: { id: true, isRedeemed: true }
  });
  const shouldRedeem =
    parsed.data.status === "DA_CHUOC"
      ? true
      : items.some((it) => !it.isRedeemed);

  await prisma.loanItem.updateMany({
    where: { loanId: ctx.params.id },
    data: {
      isRedeemed: shouldRedeem,
      redeemedAt: shouldRedeem ? new Date() : null
    }
  });

  const itemCount = items.length;
  const redeemedCount = shouldRedeem ? itemCount : 0;

  await writeAuditLog({
    user: bypass ? null : user,
    action: "PAWN_TOGGLE_REDEEM",
    targetTable: "pawn_items",
    targetId: ctx.params.id,
    details: { before, status: parsed.data.status, itemCount, redeemedCount }
  });

  return new Response(
    JSON.stringify({
      loan: {
        id: ctx.params.id,
        statusChuoc:
          itemCount > 0 && redeemedCount >= itemCount ? "DA_CHUOC" : "CHUA_CHUOC",
        itemCount,
        redeemedCount
      }
    }),
    {
    status: 200,
    headers: { "content-type": "application/json" }
    }
  );
}
