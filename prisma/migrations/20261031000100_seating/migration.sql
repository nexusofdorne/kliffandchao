-- The admin seating plan. RLS on with no policies, like every other table.
CREATE TYPE "SeatingTableKind" AS ENUM ('ROUND', 'VIP');

CREATE TABLE "SeatingTable" (
    "id" TEXT NOT NULL,
    "kind" "SeatingTableKind" NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeatingTable_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SeatAssignment" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "guestId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeatAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SeatingRoom" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeatingRoom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeatingTable_kind_number_key" ON "SeatingTable"("kind", "number");
CREATE UNIQUE INDEX "SeatAssignment_guestId_key" ON "SeatAssignment"("guestId");
CREATE UNIQUE INDEX "SeatAssignment_tableId_seat_key" ON "SeatAssignment"("tableId", "seat");
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "SeatingTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatingTable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeatAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeatingRoom" ENABLE ROW LEVEL SECURITY;
