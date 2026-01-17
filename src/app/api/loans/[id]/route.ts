import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { canDelete, getUserFromNextRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }

  const loan = await prisma.loan.findFirst({
    where: { id: ctx.params.id, deletedAt: null },
    include: { items: { include: { item: true } } }
  });
  if (!loan) {
    return jsonError(404, { code: "NOT_FOUND", message: "Không tìm thấy phiếu" });
  }

  return new Response(JSON.stringify({ loan }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const bypass = (process.env.AUTH_BYPASS ?? "").toLowerCase() === "true";
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }
  if (!canDelete(user)) {
    return jsonError(403, { code: "FORBIDDEN", message: "Không có quyền xóa" });
  }

  const mode = (process.env.LOANS_DELETE_MODE ?? "soft").toLowerCase();
  const before = await prisma.loan.findFirst({
    where: { id: ctx.params.id },
    select: {
      id: true,
      customerName: true,
      principalAmount: true,
      deletedAt: true,
      statusChuoc: true
    }
  });
  if (!before || before.deletedAt) {
    return jsonError(404, { code: "NOT_FOUND", message: "Không tìm thấy phiếu" });
  }

  if (mode === "hard") {
    await prisma.loan.delete({ where: { id: ctx.params.id } });
  } else {
    await prisma.loan.update({
      where: { id: ctx.params.id },
      data: { deletedAt: new Date() }
    });
  }

  await writeAuditLog({
    user: bypass ? null : user,
    action: "LOAN_DELETE",
    targetTable: "loans",
    targetId: ctx.params.id,
    details: {
      mode,
      before
    }
  });

  return new Response(JSON.stringify({ ok: true, mode }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

export async function PATCH() {
  return jsonError(405, {
    code: "METHOD_NOT_ALLOWED",
    message: "Use /api/loans/:id/status để đổi trạng thái"
  });
}
