import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { canDelete, canEdit, getUserFromNextRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { zLoanPatch } from "@/lib/validators";

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
    include: { items: true }
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
      cccd: true,
      totalAmountVnd: true,
      deletedAt: true,
      datePawn: true
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
    action: "PAWN_DELETE",
    targetTable: "pawn_records",
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
  const parsed = zLoanPatch.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const loan = await prisma.loan.findFirst({
    where: { id: ctx.params.id, deletedAt: null },
    select: { id: true, recordNote: true }
  });
  if (!loan) {
    return jsonError(404, { code: "NOT_FOUND", message: "Không tìm thấy phiếu" });
  }

  const updates = parsed.data;
  let updatedNote: string | null | undefined;

  await prisma.$transaction(async (tx) => {
    if (updates.recordNote !== undefined) {
      updatedNote = (updates.recordNote ?? "").trim();
      await tx.loan.update({
        where: { id: ctx.params.id },
        data: { recordNote: updatedNote }
      });
    }

    const items = updates.items ?? [];
    for (const it of items) {
      await tx.loanItem.updateMany({
        where: { id: it.id, loanId: ctx.params.id },
        data: {
          isRedeemed: it.isRedeemed,
          redeemedAt: it.isRedeemed ? new Date() : null
        }
      });
    }
  });

  const [itemCount, redeemedCount] = await Promise.all([
    prisma.loanItem.count({ where: { loanId: ctx.params.id } }),
    prisma.loanItem.count({
      where: { loanId: ctx.params.id, isRedeemed: true }
    })
  ]);

  const statusChuoc =
    itemCount > 0 && redeemedCount >= itemCount ? "DA_CHUOC" : "CHUA_CHUOC";

  await writeAuditLog({
    user: bypass ? null : user,
    action: "PAWN_UPDATE",
    targetTable: "pawn_records",
    targetId: ctx.params.id,
    details: {
      recordNote: updatedNote,
      itemCount,
      redeemedCount,
      statusChuoc
    }
  });

  return new Response(
    JSON.stringify({
      loan: {
        id: ctx.params.id,
        recordNote: updatedNote ?? loan.recordNote,
        itemCount,
        redeemedCount,
        statusChuoc
      }
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
}
