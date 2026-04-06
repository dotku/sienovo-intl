-- Tables already exist in DB (created via db push), marking as applied

CREATE TABLE IF NOT EXISTS "ApiUsage" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "linkedinUrl" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "driveFileId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_name_key" ON "Company"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeFile_driveFileId_key" ON "KnowledgeFile"("driveFileId");
CREATE INDEX IF NOT EXISTS "ApiUsage_service_createdAt_idx" ON "ApiUsage"("service", "createdAt");
CREATE INDEX IF NOT EXISTS "CompanyFile_companyId_idx" ON "CompanyFile"("companyId");

ALTER TABLE "CompanyFile" DROP CONSTRAINT IF EXISTS "CompanyFile_companyId_fkey";
ALTER TABLE "CompanyFile" ADD CONSTRAINT "CompanyFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_companyId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
