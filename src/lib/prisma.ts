import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { prisma: PrismaClient; pool: pg.Pool };

function createConnectionString() {
  return (process.env.DATABASE_URL || "").replace("sslmode=require", "sslmode=verify-full");
}

export const pool = globalForDb.pool || new pg.Pool({ connectionString: createConnectionString() });

function createPrismaClient() {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForDb.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.prisma = prisma;
  globalForDb.pool = pool;
}
