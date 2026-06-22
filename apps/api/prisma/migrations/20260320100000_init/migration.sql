-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INITIATOR');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'READY_FOR_REVIEW', 'APPROVED', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "MailingStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "NotificationType" AS ENUM ('RESPONSE_RECEIVED', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'INITIATOR',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentRecipient" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "authorId" TEXT NOT NULL,
  "queuedAt" TIMESTAMP(3),
  "processingAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "sendingAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisResult" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "tasksJson" JSONB NOT NULL,
  "rawJson" JSONB NOT NULL,
  "generationStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
  "llmProvider" TEXT NOT NULL,
  "llmModel" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentSuggestion" (
  "id" TEXT NOT NULL,
  "analysisResultId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "relevanceReason" TEXT NOT NULL,
  "problemFragment" TEXT NOT NULL,
  "adaptedPitch" TEXT NOT NULL,
  "emailSubject" TEXT NOT NULL,
  "emailBody" TEXT NOT NULL,
  "includeInMailing" BOOLEAN NOT NULL DEFAULT true,
  "customSubject" TEXT,
  "customBody" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Mailing" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "recipients" JSONB NOT NULL,
  "status" "MailingStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "responseToken" TEXT NOT NULL,
  "tokenUsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mailing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Response" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "mailingId" TEXT NOT NULL,
  "responderEmail" TEXT,
  "responderName" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "tokenSnapshot" TEXT NOT NULL,
  "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");
CREATE INDEX "DepartmentRecipient_departmentId_idx" ON "DepartmentRecipient"("departmentId");

CREATE INDEX "Project_authorId_idx" ON "Project"("authorId");
CREATE INDEX "Project_status_idx" ON "Project"("status");

CREATE UNIQUE INDEX "AnalysisResult_projectId_key" ON "AnalysisResult"("projectId");
CREATE INDEX "AnalysisResult_generationStatus_idx" ON "AnalysisResult"("generationStatus");

CREATE UNIQUE INDEX "DepartmentSuggestion_analysisResultId_departmentId_key" ON "DepartmentSuggestion"("analysisResultId", "departmentId");
CREATE INDEX "DepartmentSuggestion_departmentId_idx" ON "DepartmentSuggestion"("departmentId");

CREATE UNIQUE INDEX "Mailing_responseToken_key" ON "Mailing"("responseToken");
CREATE INDEX "Mailing_projectId_idx" ON "Mailing"("projectId");
CREATE INDEX "Mailing_departmentId_idx" ON "Mailing"("departmentId");
CREATE INDEX "Mailing_status_idx" ON "Mailing"("status");

CREATE UNIQUE INDEX "Response_mailingId_key" ON "Response"("mailingId");
CREATE INDEX "Response_projectId_idx" ON "Response"("projectId");
CREATE INDEX "Response_departmentId_idx" ON "Response"("departmentId");
CREATE INDEX "Response_respondedAt_idx" ON "Response"("respondedAt");

CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "DepartmentRecipient" ADD CONSTRAINT "DepartmentRecipient_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentSuggestion" ADD CONSTRAINT "DepartmentSuggestion_analysisResultId_fkey" FOREIGN KEY ("analysisResultId") REFERENCES "AnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentSuggestion" ADD CONSTRAINT "DepartmentSuggestion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mailing" ADD CONSTRAINT "Mailing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mailing" ADD CONSTRAINT "Mailing_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_mailingId_fkey" FOREIGN KEY ("mailingId") REFERENCES "Mailing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
