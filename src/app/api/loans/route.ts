import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { jsonError, normalizeSearchText } from "@/lib/api";
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
  const searchField =
    req.nextUrl.searchParams.get("search_field")?.trim().toLowerCase() ?? "name";
  const dateFrom = req.nextUrl.searchParams.get("date_from")?.trim() ?? "";
  const dateTo = req.nextUrl.searchParams.get("date_to")?.trim() ?? "";

  const pageSize = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("page_size") ?? "20") || 20, 1),
    100
  );
  const page = Math.max(Number(req.nextUrl.searchParams.get("page") ?? "1") || 1, 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.LoanWhereInput = {
    deletedAt: null
  };

  if (dateFrom || dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (!Number.isNaN(parsed.getTime())) {
        dateFilter.gte = parsed;
      }
    }
    if (dateTo) {
      const parsed = new Date(dateTo);
      if (!Number.isNaN(parsed.getTime())) {
        dateFilter.lte = parsed;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.datePawn = dateFilter;
    }
  }

  if (q) {
    const normalized = normalizeSearchText(q);
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(q)) {
      where.id = q;
    } else if (searchField === "cccd") {
      where.cccd = { contains: q, mode: "insensitive" };
    } else if (searchField === "item") {
      where.items = {
        some: {
          itemNameSearch: { contains: normalized, mode: "insensitive" }
        }
      };
    } else if (searchField === "amount") {
      const raw = q.toLowerCase().replace(/[, ]/g, "");
      let amount = Number(raw);
      if (!Number.isFinite(amount)) {
        if (raw.endsWith("k")) {
          amount = Number(raw.slice(0, -1)) * 1000;
        } else if (raw.endsWith("m")) {
          amount = Number(raw.slice(0, -1)) * 1_000_000;
        }
      }
      if (Number.isFinite(amount)) {
        where.totalAmountVnd = amount;
      }
    } else {
      where.customerNameSearch = { contains: normalized, mode: "insensitive" };
    }
  }

  const [total, loans] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      orderBy: [{ datePawn: "desc" }, { createdAt: "desc" }],
      take: pageSize,
      skip,
      include: {
        items: true
      }
    })
  ]);

  const mapped = loans.map((loan) => {
    const itemCount = loan.items.length;
    const redeemedCount = loan.items.filter((it) => it.isRedeemed).length;
    const itemsSummary = loan.items
      .map(
        (it) =>
          `${it.qty}x${it.itemName}(${String(it.weightChi)} Chỉ)`
      )
      .join("; ");
    return {
      ...loan,
      itemCount,
      redeemedCount,
      itemsSummary,
      statusChuoc:
        itemCount > 0 && redeemedCount >= itemCount ? "DA_CHUOC" : "CHUA_CHUOC"
    };
  });

  return new Response(
    JSON.stringify({
      page,
      page_size: pageSize,
      total,
      loans: mapped
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
}

export async function POST(req: NextRequest) {
  const bypass = (process.env.AUTH_BYPASS ?? "").toLowerCase() === "true";
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

  const datePawn = new Date(parsed.data.datePawn);
  if (Number.isNaN(datePawn.getTime())) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Ngày cầm không hợp lệ"
    });
  }
  const customerNameSearch = normalizeSearchText(parsed.data.customerName);

  type TxClient = Parameters<typeof prisma.$transaction>[0] extends (
    tx: infer Tx
  ) => unknown
    ? Tx
    : never;

  const loan = await prisma.$transaction(async (tx: TxClient) => {
    const created = await tx.loan.create({
      data: {
        customerName: parsed.data.customerName,
        customerNameSearch,
        cccd: parsed.data.cccd,
        recordNote: parsed.data.recordNote ?? "",
        totalAmountVnd: parsed.data.totalAmountVnd,
        datePawn,
        createdById: bypass ? null : user.id
      }
    });

    const items = parsed.data.items ?? [];
    for (const row of items) {
      const itemNameSearch = normalizeSearchText(row.itemName);
      await tx.loanItem.create({
        data: {
          loanId: created.id,
          qty: row.qty,
          itemName: row.itemName,
          itemNameSearch,
          weightChi: row.weightChi,
          note: row.note ?? ""
        }
      });
    }

    return await tx.loan.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true }
    });
  });

  await writeAuditLog({
    user: bypass ? null : user,
    action: "PAWN_CREATE",
    targetTable: "pawn_records",
    targetId: loan.id,
    details: {
      totalAmountVnd: loan.totalAmountVnd,
      customerName: loan.customerName,
      cccd: loan.cccd
    }
  });

  return new Response(JSON.stringify({ loan }), {
    status: 201,
    headers: { "content-type": "application/json" }
  });
}
