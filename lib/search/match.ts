import 'server-only';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { buildDisplayName } from '../guests/display-name';

export const SEARCH_RESULT_LIMIT = 8;
export const SEARCH_SCORE_THRESHOLD = 50;
const TRIGRAM_SIMILARITY_CUTOFF = 0.3; // pg_trgm's own default similarity threshold

type GuestSearchRow = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
};

// Prisma's query builder has no way to express this: it doesn't expose
// Postgres extension functions (pg_trgm's similarity(), fuzzystrmatch's
// dmetaphone()), arbitrary scoring expressions like GREATEST() across
// several candidates, or a CTE to filter on a computed column. All of that
// needs real SQL, hence $queryRaw — docs/BUILD_PLAN.md "Guest search".
export async function searchGuests(
  prisma: PrismaClient,
  query: string,
): Promise<{ id: string; displayName: string }[]> {
  const rows = await prisma.$queryRaw<GuestSearchRow[]>(Prisma.sql`
    WITH candidates AS (
      SELECT
        id,
        "firstName",
        "lastName",
        nickname,
        GREATEST(
          CASE WHEN lower("firstName") = lower(${query})
            OR lower("lastName") = lower(${query})
            OR lower(coalesce(nickname, '')) = lower(${query})
            OR lower("firstName" || ' ' || "lastName") = lower(${query})
            OR lower("lastName" || ' ' || "firstName") = lower(${query})
            THEN 100 ELSE 0 END,
          CASE WHEN lower("firstName") LIKE lower(${query}) || '%'
            OR lower("lastName") LIKE lower(${query}) || '%'
            OR lower(coalesce(nickname, '')) LIKE lower(${query}) || '%'
            THEN 90 ELSE 0 END,
          CASE WHEN lower("firstName") LIKE '%' || lower(${query}) || '%'
            OR lower("lastName") LIKE '%' || lower(${query}) || '%'
            OR lower(coalesce(nickname, '')) LIKE '%' || lower(${query}) || '%'
            THEN 70 ELSE 0 END,
          CASE WHEN similarity(lower("firstName"), lower(${query})) > ${TRIGRAM_SIMILARITY_CUTOFF}
            OR similarity(lower("lastName"), lower(${query})) > ${TRIGRAM_SIMILARITY_CUTOFF}
            OR similarity(lower(coalesce(nickname, '')), lower(${query})) > ${TRIGRAM_SIMILARITY_CUTOFF}
            THEN 65 ELSE 0 END,
          CASE WHEN dmetaphone("firstName") = dmetaphone(${query})
            OR dmetaphone("lastName") = dmetaphone(${query})
            OR (nickname IS NOT NULL AND dmetaphone(nickname) = dmetaphone(${query}))
            THEN 55 ELSE 0 END
        ) AS score
      FROM "Guest"
      WHERE "archivedAt" IS NULL
    )
    SELECT id, "firstName", "lastName", nickname
    FROM candidates
    WHERE score >= ${SEARCH_SCORE_THRESHOLD}
    ORDER BY score DESC
    LIMIT ${SEARCH_RESULT_LIMIT}
  `);

  return rows.map((row) => ({
    id: row.id,
    displayName: buildDisplayName(row.firstName, row.lastName, row.nickname),
  }));
}
