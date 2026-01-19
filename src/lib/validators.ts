import { z } from "zod";

export const zLogin = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

export const zItemCreate = z.object({
  itemName: z.string().trim().min(1).max(200),
  defaultWeightChi: z.number().finite().nonnegative(),
  note: z.string().trim().max(2000).optional().nullable()
});

export const zItemUpdate = zItemCreate.partial();

export const zLoanCreate = z.object({
  customerName: z.string().trim().min(1).max(200),
  cccd: z.string().trim().min(1).max(50),
  totalAmountVnd: z.number().finite().nonnegative(),
  datePawn: z.string().min(1),
  recordNote: z.string().trim().max(5000).optional().nullable(),
  items: z
    .array(
      z.object({
        qty: z.number().int().positive(),
        itemName: z.string().trim().min(1).max(200),
        weightChi: z.number().finite().nonnegative(),
        note: z.string().trim().max(2000).optional().nullable()
      })
    )
    .optional()
    .nullable()
});

export const zLoanStatusPatch = z.object({
  status: z.enum(["DA_CHUOC", "CHUA_CHUOC"])
});

export const zLoanPatch = z.object({
  recordNote: z.string().trim().max(5000).optional().nullable(),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        isRedeemed: z.boolean()
      })
    )
    .optional()
    .nullable()
});

export const zExportBody = z.object({
  q: z.string().optional().nullable(),
  search_field: z
    .enum(["name", "cccd", "item", "amount"])
    .optional()
    .nullable(),
  date_from: z.string().optional().nullable(),
  date_to: z.string().optional().nullable()
});
