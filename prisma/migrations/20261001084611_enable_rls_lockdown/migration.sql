-- Supabase exposes the public schema through its Data API, and the anon key
-- ships to the browser (needed for admin login). Enabling RLS with no
-- policies on every table means the Data API returns nothing for any of
-- them, while Prisma (connecting as the table owner) bypasses RLS entirely
-- and is unaffected. See docs/BUILD_PLAN.md "Supabase security".
ALTER TABLE "Party" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RsvpSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RsvpResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GuestRsvp" ENABLE ROW LEVEL SECURITY;
