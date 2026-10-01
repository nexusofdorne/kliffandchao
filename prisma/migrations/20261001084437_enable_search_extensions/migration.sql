-- Needed for Phase 3 guest search: pg_trgm (trigram similarity) and
-- fuzzystrmatch (dmetaphone) back the scoring ladder in docs/BUILD_PLAN.md
-- "Guest search". Not expressible in schema.prisma, hence a hand-written
-- migration rather than a generated one.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
