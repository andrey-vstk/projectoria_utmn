-- Soft deletion keeps historic project suggestions, mailings, and responses intact.
ALTER TABLE "Department" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");
