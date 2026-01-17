import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { canEdit, getUserFromNextRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { zLoanCreate } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const status = req.nextUrl.searchParams.get("status")?.trim() ?? "";

  const amount = req.nextUrl.searchParams.get("amount");
  const amountMin = req.nextUrl.searchParams.get("amount_min");
  const amountMax = req.nextUrl.searchParams.get("amount_max");

  const pageSize = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("page_size") ?? "20") || 20, 1),
    100
  );
  const page = Math.max(Number(req.nextUrl.searchParams.get("page") ?? "1") || 1, 1);
  const skip = (page - 1) * pageSize;

  type LoanWhere = NonNullable<Parameters<typeof prisma.loan.findMany>[0]>["where"];
  const where: LoanWhere = {
    deletedAt: null
  };

  if (q) {
    const or: NonNullable<typeof where.OR> = [
      { customerName: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } }
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q)) {
      or.push({ id: q });
    }
    where.OR = or;
  }

  if (status === "CHUA_CHUOC" || status === "DA_CHUOC") {
    where.statusChuoc = status;
  }

  const amountNumber = amount ? Number(amount) : null;
  const minNumber = amountMin ? Number(amountMin) : null;
  const maxNumber = amountMax ? Number(amountMax) : null;

  if (amountNumber !== null && Number.isFinite(amountNumber)) {
    where.principalAmount = amountNumber;
  } else if (
    (minNumber !== null && Number.isFinite(minNumber)) ||
    (maxNumber !== null && Number.isFinite(maxNumber))
  ) {
    where.principalAmount = {
      ...(minNumber !== null && Number.isFinite(minNumber) ? { gte: minNumber } : {}),
      ...(maxNumber !== null && Number.isFinite(maxNumber) ? { lte: maxNumber } : {})
    };
  }

  const [total, loans] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: pageSize,
      skip,
      include: {
        items: {
          include: { item: true }
        }
      }
    })
  ]);

  return new Response(
    JSON.stringify({
      page,
      page_size: pageSize,
      total,
      loans
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
}

export async function POST(req: NextRequest) {
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }
  if (!canEdit(user)) {
    return jsonError(403, { code: "FORBIDDEN", message: "Không có quyền tạo phiếu" });
  }

  const body = await req.json().catch(() => null);
  const parsed = zLoanCreate.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

  type TxClient = Parameters<typeof prisma.$transaction>[0] extends (
    tx: infer Tx
  ) => unknown
    ? Tx
    : never;

  const loan = await prisma.$transaction(async (tx: TxClient) => {
    const created = await tx.loan.create({
      data: {
        customerName: parsed.data.customerName,
        principalAmount: parsed.data.principalAmount,
        dueDate,
        notes: parsed.data.notes ?? null,
        createdById: user.id
      }
    });

    const items = parsed.data.items ?? [];
    for (const row of items) {
      let itemId = row.itemId ?? null;
      if (!itemId && row.name) {
        const newItem = await tx.item.create({
          data: {
            code: row.code ?? null,
            name: row.name,
            unit: row.unit ?? null,
            description: row.description ?? null,
            price: row.price ?? null,
            barcode: row.barcode ?? null
          }
        });
        itemId = newItem.id;
      }

      await tx.loanItem.create({
        data: {
          loanId: created.id,
          itemId,
          quantity: row.quantity ?? null,
          note: row.note ?? null
        }
      });
    }

    return await tx.loan.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: { include: { item: true } } }
    });
  });

  await writeAuditLog({
    user,
    action: "LOAN_CREATE",
    targetTable: "loans",
    targetId: loan.id,
    details: { principalAmount: loan.principalAmount, customerName: loan.customerName }
  });

  return new Response(JSON.stringify({ loan }), {
    status: 201,
    headers: { "content-type": "application/json" }
  });
}
