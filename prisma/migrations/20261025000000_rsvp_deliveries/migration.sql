CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'SHEETS');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REVIEW');

CREATE TABLE "RsvpDelivery" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "sheetId" TEXT,
    "sheetStartRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RsvpDelivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SheetMirrorCursor" (
    "sheetId" TEXT NOT NULL,
    "nextRow" INTEGER NOT NULL,
    CONSTRAINT "SheetMirrorCursor_pkey" PRIMARY KEY ("sheetId")
);
CREATE UNIQUE INDEX "RsvpDelivery_submissionId_channel_key" ON "RsvpDelivery"("submissionId", "channel");
CREATE INDEX "RsvpDelivery_status_createdAt_idx" ON "RsvpDelivery"("status", "createdAt");
ALTER TABLE "RsvpDelivery" ADD CONSTRAINT "RsvpDelivery_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "RsvpSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RsvpDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SheetMirrorCursor" ENABLE ROW LEVEL SECURITY;
