import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
const password = "1234";

if (!password) {
  console.error("Missing SEED_ADMIN_PASSWORD");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

await prisma.user.upsert({
  where: { username },
  update: { passwordHash, role: "ADMIN" },
  create: { username, passwordHash, role: "ADMIN" }
});

console.log(`Seeded admin user: ${username}`);

await prisma.$disconnect();

