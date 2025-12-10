import { PrismaClient } from "@prisma/client";

type GlobalPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalPrisma = globalThis as GlobalPrisma;

const prisma = globalPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalPrisma.prisma = prisma;
}

export default prisma;
