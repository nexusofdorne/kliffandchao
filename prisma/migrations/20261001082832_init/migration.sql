-- CreateEnum
CREATE TYPE "Side" AS ENUM ('KLIFF', 'CHAO', 'BOTH');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ATTENDING', 'NOT_ATTENDING');

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickname" TEXT,
    "side" "Side" NOT NULL,
    "notesPrivate" TEXT,
    "archivedAt" TIMESTAMP(3),
    "partyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RsvpSubmission" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "submittedByGuestId" TEXT NOT NULL,
    "message" VARCHAR(500),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RsvpSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RsvpResponse" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RsvpResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestRsvp" (
    "guestId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL,
    "respondedByGuestId" TEXT NOT NULL,
    "lastSubmissionId" TEXT NOT NULL,

    CONSTRAINT "GuestRsvp_pkey" PRIMARY KEY ("guestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_externalId_key" ON "Party"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_externalId_key" ON "Guest"("externalId");

-- CreateIndex
CREATE INDEX "Guest_partyId_idx" ON "Guest"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpResponse_submissionId_guestId_key" ON "RsvpResponse"("submissionId", "guestId");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpSubmission" ADD CONSTRAINT "RsvpSubmission_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpResponse" ADD CONSTRAINT "RsvpResponse_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "RsvpSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpResponse" ADD CONSTRAINT "RsvpResponse_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRsvp" ADD CONSTRAINT "GuestRsvp_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
