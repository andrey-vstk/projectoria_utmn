-- AlterTable
ALTER TABLE "Department"
ADD COLUMN "competencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DepartmentRecipient"
ADD COLUMN "competencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
