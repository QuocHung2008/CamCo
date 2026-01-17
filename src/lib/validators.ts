import { z } from "zod";

export const zLogin = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

export const zItemCreate = z.object({
  code: z.string().trim().min(1).max(100).optional().nullable(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  price: z.number().finite().nonnegative().optional().nullable(),
  barcode: z.string().trim().max(200).optional().nullable()
});

export const zItemUpdate = zItemCreate.partial();

export const zLoanCreate = z.object({
  customerName: z.string().trim().min(1).max(200),
  principalAmount: z.number().finite().nonnegative(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid().optional().nullable(),
        name: z.string().trim().min(1).max(200).optional().nullable(),
        code: z.string().trim().min(1).max(100).optional().nullable(),
        unit: z.string().trim().max(50).optional().nullable(),
        description: z.string().trim().max(2000).optional().nullable(),
        price: z.number().finite().nonnegative().optional().nullable(),
        barcode: z.string().trim().max(200).optional().nullable(),
        quantity: z.number().int().positive().optional().nullable(),
        note: z.string().trim().max(2000).optional().nullable()
      })
    )
    .optional()
    .nullable()
});

export const zLoanStatusPatch = z.object({
  status: z.enum(["DA_CHUOC", "CHUA_CHUOC"])
});

export const zExportBody = z.object({
  q: z.string().optional().nullable(),
  amount: z.number().finite().nonnegative().optional().nullable(),
  amount_min: z.number().finite().nonnegative().optional().nullable(),
  amount_max: z.number().finite().nonnegative().optional().nullable(),
  status: z.enum(["DA_CHUOC", "CHUA_CHUOC"]).optional().nullable()
});

