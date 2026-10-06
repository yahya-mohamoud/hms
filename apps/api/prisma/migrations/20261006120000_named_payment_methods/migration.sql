ALTER TYPE "PaymentMethod" ADD VALUE 'COOPAY_EBIRR';
ALTER TYPE "PaymentMethod" ADD VALUE 'EBIRR_KAAFI';
ALTER TYPE "PaymentMethod" ADD VALUE 'CBE_BANK';
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';

ALTER TABLE "DailyAudit"
  ADD COLUMN "coopayEbirrPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "ebirrKaafiPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cbeBankPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "otherPayments" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Previous payment channels cannot be mapped accurately to the new providers.
-- Keep the old columns intact and include their historical totals under Other.
UPDATE "DailyAudit"
SET "otherPayments" = "mobileMoneyPayments" + "cardPayments" + "bankTransferPayments";
