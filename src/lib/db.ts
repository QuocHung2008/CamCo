import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// if (!process.env.DATABASE_URL && process.env.SUPABASE_DATABASE_URL) {
//   process.env.DATABASE_URL = process.env.SUPABASE_DATABASE_URL;
// }

if (!process.env.DATABASE_URL) {
  const fromNeon =
    process.env.NEON_DATABASE_URL ??
    process.env.NEON_POSTGRES_URL_NON_POOLING ??
    process.env.NEON_POSTGRES_URL;
  if (fromNeon) process.env.DATABASE_URL = fromNeon;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
