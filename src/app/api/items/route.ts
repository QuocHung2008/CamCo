import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { canEdit, getUserFromNextRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { zItemCreate } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "20") || 20, 1),
    50
  );

  const items = await prisma.item.findMany({
    where: q ? { itemName: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: [{ itemName: "asc" }, { createdAt: "desc" }],
    take: limit
  });

  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

export async function POST(req: NextRequest) {
  const bypass = (process.env.AUTH_BYPASS ?? "").toLowerCase() === "true";
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }
  if (!canEdit(user)) {
    return jsonError(403, { code: "FORBIDDEN", message: "Không có quyền sửa" });
  }

  const body = await req.json().catch(() => null);
  const parsed = zItemCreate.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const item = await prisma.item.create({
    data: {
      itemName: parsed.data.itemName,
      defaultWeightChi: parsed.data.defaultWeightChi,
      note: parsed.data.note ?? ""
    }
  });

  await writeAuditLog({
    user: bypass ? null : user,
    action: "CATALOG_CREATE",
    targetTable: "pawn_catalog",
    targetId: item.id,
    details: { itemName: item.itemName, defaultWeightChi: item.defaultWeightChi }
  });

  return new Response(JSON.stringify({ item }), {
    status: 201,
    headers: { "content-type": "application/json" }
  });
}
