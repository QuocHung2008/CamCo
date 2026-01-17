import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { canEdit, getUserFromNextRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { zItemUpdate } from "@/lib/validators";

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
  const parsed = zItemUpdate.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const before = await prisma.item.findUnique({
    where: { id: ctx.params.id }
  });

  const item = await prisma.item.update({
    where: { id: ctx.params.id },
    data: {
      code: parsed.data.code ?? undefined,
      name: parsed.data.name ?? undefined,
      unit: parsed.data.unit ?? undefined,
      description: parsed.data.description ?? undefined,
      price: parsed.data.price ?? undefined,
      barcode: parsed.data.barcode ?? undefined
    }
  });

  await writeAuditLog({
    user: bypass ? null : user,
    action: "ITEM_UPDATE",
    targetTable: "items",
    targetId: item.id,
    details: { before, after: item }
  });

  return new Response(JSON.stringify({ item }), {
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
  if (!canEdit(user)) {
    return jsonError(403, { code: "FORBIDDEN", message: "Không có quyền sửa" });
  }

  const before = await prisma.item.findUnique({
    where: { id: ctx.params.id }
  });

  await prisma.item.delete({ where: { id: ctx.params.id } });

  await writeAuditLog({
    user: bypass ? null : user,
    action: "ITEM_DELETE",
    targetTable: "items",
    targetId: ctx.params.id,
    details: { before }
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
