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
    select: { id: true, statusChuoc: true }
  });
  if (!before) {
    return jsonError(404, { code: "NOT_FOUND", message: "Không tìm thấy phiếu" });
  }

  const loan = await prisma.loan.update({
    where: { id: ctx.params.id },
    data: { statusChuoc: parsed.data.status },
    select: { id: true, statusChuoc: true }
  });

  await writeAuditLog({
    user,
    action: "LOAN_STATUS_TOGGLE",
    targetTable: "loans",
    targetId: loan.id,
    details: { before, after: loan }
  });

  return new Response(JSON.stringify({ loan }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
