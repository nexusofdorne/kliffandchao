import 'server-only';
import { JWT } from 'google-auth-library';
import { env } from '../env';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

type ServiceAccountKey = { client_email: string; private_key: string };

function loadServiceAccountKey(): ServiceAccountKey {
  // Base64, not the raw JSON — docs/PLAN.md "Google Cloud setup": the raw
  // private key's embedded \n escaping breaks differently in .env.local,
  // PowerShell and Vercel's dashboard, and Windows CRLF makes it worse.
  const decoded = Buffer.from(env.GOOGLE_SA_KEY_B64, 'base64').toString('utf8');
  return JSON.parse(decoded) as ServiceAccountKey;
}

// One JWT client for the process, same reasoning as lib/prisma.ts's
// singleton: it's expensive enough to construct that per-request creation
// would be wasteful, and google-auth-library already caches the access
// token internally until it's close to expiry.
let cachedClient: JWT | null = null;

function getAuthClient(): JWT {
  if (!cachedClient) {
    const key = loadServiceAccountKey();
    cachedClient = new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
  }
  return cachedClient;
}

// Thin wrapper over the Sheets API v4 REST surface, scoped to this
// project's one spreadsheet. `path` is everything after the spreadsheet id
// (e.g. `/values/Guests` or `/values/RSVP_Log!A:H:append`); query params
// like valueInputOption are the caller's own responsibility, same as
// docs/PLAN.md's sheetsFetch sketch.
export async function sheetsFetch(path: string, init?: RequestInit): Promise<Response> {
  const client = getAuthClient();
  const { token } = await client.getAccessToken();

  return fetch(`${SHEETS_API_BASE}/${env.GOOGLE_SHEET_ID}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
