-- CreateEnum
CREATE TYPE "ResponseDecision" AS ENUM ('ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Response"
ADD COLUMN "decision" "ResponseDecision" NOT NULL DEFAULT 'ACCEPTED';
