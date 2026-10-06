CREATE TYPE "ExpenseCategory" AS ENUM (
  'UTILITIES',
  'SUPPLIES',
  'MAINTENANCE',
  'FOOD',
  'TRANSPORT',
  'SALARIES',
  'TAXES',
  'OTHER'
);

ALTER TABLE "Reservation"
ADD COLUMN "depositReceivedAt" TIMESTAMP(3);

ALTER TABLE "DailyAudit"
ADD COLUMN "expensesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "netCash" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Reservation"
SET "depositReceivedAt" = "createdAt"
WHERE "depositAmount" > 0;

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "payee" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "expenseDate" DATE NOT NULL,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_expenseDate_voidedAt_idx" ON "Expense"("expenseDate", "voidedAt");
CREATE INDEX "Expense_category_expenseDate_idx" ON "Expense"("category", "expenseDate");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
