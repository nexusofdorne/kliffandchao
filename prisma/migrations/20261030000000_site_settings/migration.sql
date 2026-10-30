-- The couple's site settings from /admin (one row, id 1). RLS on with no policies, like every
-- other table: the Data API sees nothing, Prisma (the owner) is unaffected.
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "sitePasswordHash" TEXT,
    "passwordOpen" BOOLEAN NOT NULL DEFAULT false,
    "rsvpClosed" BOOLEAN NOT NULL DEFAULT false,
    "sessionGeneration" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SiteSettings" ENABLE ROW LEVEL SECURITY;
