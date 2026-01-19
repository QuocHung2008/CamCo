import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import archiver, { type Archiver, type ArchiverOptions, type Format } from "archiver";
import zipEncrypted from "archiver-zip-encrypted";
import { PassThrough, Readable } from "stream";

import { jsonError, normalizeSearchText } from "@/lib/api";
import { canExport, getUserFromNextRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { zExportBody } from "@/lib/validators";

export const runtime = "nodejs";

archiver.registerFormat("zip-encrypted", zipEncrypted);

const PASSWORD = "197781";

export async function POST(req: NextRequest) {
  const bypass = (process.env.AUTH_BYPASS ?? "").toLowerCase() === "true";
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }
  if (!canExport(user)) {
    return jsonError(403, { code: "FORBIDDEN", message: "Không có quyền export" });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = zExportBody.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const where: Prisma.LoanWhereInput = { deletedAt: null };
  if (parsed.data.date_from || parsed.data.date_to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (parsed.data.date_from) {
      const parsedDate = new Date(parsed.data.date_from);
      if (!Number.isNaN(parsedDate.getTime())) {
        dateFilter.gte = parsedDate;
      }
    }
    if (parsed.data.date_to) {
      const parsedDate = new Date(parsed.data.date_to);
      if (!Number.isNaN(parsedDate.getTime())) {
        dateFilter.lte = parsedDate;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.datePawn = dateFilter;
    }
  }

  if (parsed.data.q) {
    const q = parsed.data.q.trim();
    const normalized = normalizeSearchText(q);
    const searchField = (parsed.data.search_field ?? "name").toLowerCase();
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

  const loans = await prisma.loan.findMany({
    where,
    orderBy: [{ datePawn: "desc" }, { createdAt: "desc" }],
    take: 50000,
    include: { items: true }
  });

  const wb = new ExcelJS.Workbook();
  const sheetRecords = wb.addWorksheet("PhieuCam");
  sheetRecords.columns = [
    { header: "ID", key: "id", width: 38 },
    { header: "Khách hàng", key: "customerName", width: 24 },
    { header: "CCCD", key: "cccd", width: 16 },
    { header: "Tổng tiền (VNĐ)", key: "totalAmountVnd", width: 16 },
    { header: "Ngày cầm", key: "datePawn", width: 14 },
    { header: "Món hàng", key: "itemsSummary", width: 36 },
    { header: "Đã chuộc", key: "redeemedText", width: 12 },
    { header: "Ngày chuộc", key: "redeemedAt", width: 20 },
    { header: "Tổng món", key: "itemCount", width: 10 }
  ];
  sheetRecords.getRow(1).font = { bold: true };

  const sheetItems = wb.addWorksheet("ChiTiet");
  sheetItems.columns = [
    { header: "ID phiếu", key: "recordId", width: 38 },
    { header: "Khách hàng", key: "customerName", width: 24 },
    { header: "CCCD", key: "cccd", width: 16 },
    { header: "SL", key: "qty", width: 8 },
    { header: "Món hàng", key: "itemName", width: 28 },
    { header: "Trọng lượng (Chỉ)", key: "weightChi", width: 16 },
    { header: "Đã chuộc", key: "redeemedText", width: 12 },
    { header: "Ngày chuộc", key: "redeemedAt", width: 20 }
  ];
  sheetItems.getRow(1).font = { bold: true };

  for (const loan of loans) {
    const itemCount = loan.items.length;
    const redeemedItems = loan.items.filter((it) => it.isRedeemed);
    const redeemedCount = redeemedItems.length;
    const itemsSummary = loan.items
      .map(
        (it) => `${it.qty}x${it.itemName}(${String(it.weightChi)} Chỉ)`
      )
      .join("; ");
    const isFullyRedeemed = itemCount > 0 && redeemedCount >= itemCount;
    const redeemedAt = isFullyRedeemed
      ? redeemedItems
          .map((it) => it.redeemedAt)
          .filter((v): v is Date => v instanceof Date)
          .sort((a, b) => b.getTime() - a.getTime())[0]
      : null;

    sheetRecords.addRow({
      id: loan.id,
      customerName: loan.customerName,
      cccd: loan.cccd,
      totalAmountVnd: String(loan.totalAmountVnd),
      datePawn: loan.datePawn.toISOString().slice(0, 10),
      itemsSummary,
      redeemedText: isFullyRedeemed ? "Đã chuộc" : "Chưa chuộc",
      redeemedAt: redeemedAt ? redeemedAt.toISOString() : "",
      itemCount
    });

    for (const it of loan.items) {
      sheetItems.addRow({
        recordId: loan.id,
        customerName: loan.customerName,
        cccd: loan.cccd,
        qty: it.qty,
        itemName: it.itemName,
        weightChi: String(it.weightChi),
        redeemedText: it.isRedeemed ? "Đã chuộc" : "Chưa chuộc",
        redeemedAt: it.redeemedAt ? it.redeemedAt.toISOString() : ""
      });
    }
  }

  const xlsxData = await wb.xlsx.writeBuffer();
  const xlsxBuffer = Buffer.isBuffer(xlsxData)
    ? xlsxData
    : Buffer.from(xlsxData as ArrayBuffer);

  const zipStream = new PassThrough();
  const archive = archiver("zip-encrypted" as unknown as Format, {
    zlib: { level: 8 },
    encryptionMethod: "aes256",
    password: PASSWORD
  } as unknown as ArchiverOptions) as unknown as Archiver;

  archive.on("error", (err: Error) => {
    zipStream.destroy(err);
  });

  archive.pipe(zipStream);
  archive.append(xlsxBuffer, { name: "loans.xlsx" });
  archive.finalize();

  await writeAuditLog({
    user: bypass ? null : user,
    action: "EXPORT_PAWN",
    targetTable: "pawn_records",
    details: { filters: parsed.data, count: loans.length, format: "zip_aes256" }
  });

  const fileName = `export_pawn_${new Date().toISOString().slice(0, 10)}.zip`;
  return new Response(
    Readable.toWeb(zipStream) as unknown as ReadableStream<Uint8Array>,
    {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${fileName}"`
    }
    }
  );
}
