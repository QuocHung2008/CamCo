import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import archiver, { type Archiver, type ArchiverOptions, type Format } from "archiver";
import zipEncrypted from "archiver-zip-encrypted";
import { PassThrough, Readable } from "stream";

import { jsonError } from "@/lib/api";
import { canExport, getUserFromNextRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { zExportBody } from "@/lib/validators";

export const runtime = "nodejs";

archiver.registerFormat("zip-encrypted", zipEncrypted);

const PASSWORD = "197781";

export async function POST(req: NextRequest) {
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

  type LoanWhere = NonNullable<Parameters<typeof prisma.loan.findMany>[0]>["where"];
  const where: LoanWhere = { deletedAt: null };
  if (parsed.data.q) {
    const or: NonNullable<typeof where.OR> = [
      { customerName: { contains: parsed.data.q, mode: "insensitive" } },
      { notes: { contains: parsed.data.q, mode: "insensitive" } }
    ];
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.data.q
      )
    ) {
      or.push({ id: parsed.data.q });
    }
    where.OR = or;
  }
  if (parsed.data.status) where.statusChuoc = parsed.data.status;
  if (parsed.data.amount !== null && parsed.data.amount !== undefined) {
    where.principalAmount = parsed.data.amount;
  } else if (
    parsed.data.amount_min !== null ||
    parsed.data.amount_max !== null
  ) {
    where.principalAmount = {
      ...(parsed.data.amount_min !== null && parsed.data.amount_min !== undefined
        ? { gte: parsed.data.amount_min }
        : {}),
      ...(parsed.data.amount_max !== null && parsed.data.amount_max !== undefined
        ? { lte: parsed.data.amount_max }
        : {})
    };
  }

  const loans = await prisma.loan.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 50000
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Loans");
  sheet.columns = [
    { header: "ID", key: "id", width: 38 },
    { header: "Khách hàng", key: "customerName", width: 24 },
    { header: "Số tiền", key: "principalAmount", width: 14 },
    { header: "Trạng thái chuộc", key: "statusChuoc", width: 16 },
    { header: "Ngày hẹn", key: "dueDate", width: 14 },
    { header: "Ghi chú", key: "notes", width: 32 },
    { header: "Tạo lúc", key: "createdAt", width: 22 }
  ];
  sheet.getRow(1).font = { bold: true };

  for (const loan of loans) {
    sheet.addRow({
      id: loan.id,
      customerName: loan.customerName,
      principalAmount: String(loan.principalAmount),
      statusChuoc: loan.statusChuoc,
      dueDate: loan.dueDate ? loan.dueDate.toISOString().slice(0, 10) : "",
      notes: loan.notes ?? "",
      createdAt: loan.createdAt.toISOString()
    });
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
    user,
    action: "EXPORT_LOANS",
    targetTable: "loans",
    details: { filters: parsed.data, count: loans.length, format: "zip_aes256" }
  });

  const fileName = `export_loans_${new Date().toISOString().slice(0, 10)}.zip`;
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
