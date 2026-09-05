-- CreateEnum
CREATE TYPE "SalaryRuleCategory" AS ENUM ('BASIC', 'ALLOWANCE', 'OVERTIME', 'GROSS', 'DEDUCTION', 'CONTRIBUTION', 'NET');

-- CreateEnum
CREATE TYPE "SalaryRuleMethod" AS ENUM ('FIXED', 'PERCENTAGE', 'FORMULA');

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRule" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "method" "SalaryRuleMethod" NOT NULL,
    "fixedAmount" DECIMAL(18,2),
    "percentageRate" DECIMAL(9,4),
    "percentageBase" TEXT,
    "formula" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalaryRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_nameKey_key" ON "SalaryStructure"("nameKey");

-- CreateIndex
CREATE INDEX "SalaryStructure_status_idx" ON "SalaryStructure"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRule_salaryStructureId_code_key" ON "SalaryRule"("salaryStructureId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRule_salaryStructureId_sequence_key" ON "SalaryRule"("salaryStructureId", "sequence");

-- CreateIndex
CREATE INDEX "SalaryRule_salaryStructureId_status_sequence_idx" ON "SalaryRule"("salaryStructureId", "status", "sequence");

-- CreateIndex
CREATE INDEX "SalaryRule_category_idx" ON "SalaryRule"("category");

-- CreateIndex
CREATE INDEX "SalaryRule_method_idx" ON "SalaryRule"("method");

-- AddForeignKey
ALTER TABLE "SalaryRule" ADD CONSTRAINT "SalaryRule_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add Structure Constraints
ALTER TABLE "SalaryStructure"
  ADD CONSTRAINT "SalaryStructure_name_length_check"
  CHECK (length(trim("name")) >= 2 AND length(trim("name")) <= 100),
  ADD CONSTRAINT "SalaryStructure_nameKey_normalized_check"
  CHECK ("nameKey" = lower(trim("nameKey")));

-- Add SalaryRule Constraints
ALTER TABLE "SalaryRule"
  ADD CONSTRAINT "SalaryRule_code_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  ADD CONSTRAINT "SalaryRule_sequence_check"
  CHECK ("sequence" > 0 AND "sequence" <= 1000000),
  ADD CONSTRAINT "SalaryRule_fixedAmount_check"
  CHECK ("fixedAmount" IS NULL OR "fixedAmount" >= 0),
  ADD CONSTRAINT "SalaryRule_percentageRate_check"
  CHECK ("percentageRate" IS NULL OR ("percentageRate" >= 0 AND "percentageRate" <= 1000)),
  ADD CONSTRAINT "SalaryRule_method_fields_check"
  CHECK (
    ("method" = 'FIXED' AND "fixedAmount" IS NOT NULL AND "percentageRate" IS NULL AND "percentageBase" IS NULL AND "formula" IS NULL)
    OR
    ("method" = 'PERCENTAGE' AND "fixedAmount" IS NULL AND "percentageRate" IS NOT NULL AND "percentageBase" IS NOT NULL AND "formula" IS NULL)
    OR
    ("method" = 'FORMULA' AND "fixedAmount" IS NULL AND "percentageRate" IS NULL AND "percentageBase" IS NULL AND "formula" IS NOT NULL)
  );
