# kliffandchao

Private, password-gated wedding website for Kliff & Chao (5 March 2027, Cebu).

See `docs/BUILD_PLAN.md` and `docs/PLAN.md` for the full architecture/design specs, and `CLAUDE.md` for the engineering rules this repo follows. This README is a practical guide to **where to edit content** — no code changes needed for anything below.

## Local setup

Use **Node 24 LTS** (`.nvmrc` records the major version). `npm install` rejects unsupported Node versions before running package install scripts.

1. Run `npm ci` to install the locked dependencies and generate Prisma Client.
2. Copy `.env.example` to `.env.local` and fill in your configuration. Keep this file private.
3. Run `npm run hash-password -- <password>`. Its output is a complete `SITE_PASSWORD_HASH=...` line with dollar signs already escaped for Next.js. Replace the local line with that output. For Vercel, generate a **raw value** with `npm run hash-password -- <password> --vercel`; do not paste local escape characters into its dashboard.
4. Run `npm run check:setup` and `npm run typecheck`. Type checking generates Next.js route types automatically.
5. Run `npm run dev`. Restart it after changing environment variables.

`check:setup` checks configuration structure and generated files without printing credentials or connecting to external services. It cannot confirm credentials are accepted or that the database has the required migrations.

`npm run verify` runs lint, type checking, and unit tests. Database integration tests additionally require `.env.test` with an explicit `TEST_DATABASE_URL`, migrations, and test fixtures in a separate database. They refuse to fall back to `.env.local` or use the application's database. No email or Sheets requests are made by the delivery integration tests.

The separate Supabase project **kliffandchao-test** is configured locally in `.env.test` with a dedicated test login. Its password is private and gitignored. The public Supabase CA is saved in `config/supabase-ca.crt`; `TEST_DATABASE_CA_CERT` enables full certificate and hostname verification for the test connection.

```powershell
npm run db:prepare-test  # apply migrations and seed synthetic households in the separate test DB
npm run test:db          # run the database integration tests
```

Both commands share the same target checks. Preparation overrides `DIRECT_URL` for child commands instead of allowing `.env.local` to select the application database. It also enables RLS on Prisma's internal migration table. The CA URL parameters are adapted for Prisma Migrate and the pg driver while keeping certificate verification enabled in both. To move this checkout to another computer, configure its own `.env.test`; credentials are not committed.

## RSVP delivery recovery

An RSVP saves its answers and two pending delivery records in one transaction. Next.js `after()` runs the email and Sheets work after the guest response. If a function is interrupted, the pending or failed work remains visible under **RSVP deliveries** in `/admin`. Use **Retry** there; active tasks become retryable after their five-minute lease expires.

Email retries reuse both the saved message and its Resend idempotency key. Resend retains keys for 24 hours; after 23 hours from the first attempt the dashboard requires review rather than risking another email. Check Resend and the inbox before sending anything manually. Success means the provider accepted the email, not that it reached the inbox.

Sheets deliveries reserve fixed row ranges after existing `RSVP_Log` content. A retry rewrites its range, so a lost response cannot append duplicate answers. Treat `RSVP_Log` as an application-managed log: do not sort it in place, insert/delete its rows, or let another script append there. Use a separate tab for sorted views. The `Guests` tab remains editable as before. Changing the configured spreadsheet while a delivery is pending requires review because its reserved range belongs to the original sheet.

Before running this version against a database, apply the additive `20261025000000_rsvp_deliveries` migration using `npm run db:deploy` **with the intended database configured**. It creates two tables and enables RLS; existing guest and RSVP records are retained. Deploy the migration before deploying the updated application. Existing historical submissions are not automatically emailed or mirrored again.

## Content editing guide

Everything project-specific (copy, images, settings) lives in `config/site.ts` and `content/`. You should never need to touch `lib/`, `app/api/`, or `prisma/` to change wording, photos, or wedding details.

### 1. Site-wide settings

**[config/site.ts](config/site.ts)** — couple names, wedding date/time, venue name/location/coordinates, background audio, and the Instagram link used in the FAQ design credit.

```ts
coupleNames: 'Kliff & Chao',
weddingDateDisplay: 'March 5, 2027',
weddingDate: '2027-03-05',
weddingDateTime: '2027-03-05T16:00:00+08:00', // drives the live countdown
venueName: 'Jpark Island Resort & Waterpark',
venueLocation: 'Cebu',
venueCoordinates: { lat: 10.282, lng: 123.996444 },
audioSrc: '/audio/the-blessing.mp3',
audioTitle: 'The Blessing',
chaodesignUrl: 'https://www.instagram.com/chaodesign.ph/...', // keep the utm_source/utm_medium params — see comment in file
```

### 2. Background images (per page/panel)

All page background paths live in **`config/site.ts` → `backgrounds`**:

| Page / panel | Setting | Default |
|---|---|---|
| Intro video | `introVideo` | `/video/intro-web.mp4` |
| Intro video poster | `introPoster` | `/img/intro-poster.jpg` |
| Password / gate screen | `gate` | `/img/intro.jpg` |
| Journey panel | `journey` | `/img/p1_Im0.jpg` |
| Wedding panel | `wedding` | `/img/p1_Im0.jpg` |
| RSVP overlay | `rsvp` | `/img/p1_Im0.jpg` |

The actual image files live in **[public/img/](public/img/)** — anything under `public/` is served from the site root, so `/img/foo.jpg` in code = `public/img/foo.jpg` on disk. Currently only 6 placeholder files exist there (`intro.jpg`, `intro-poster.jpg`, `p1_Im0.jpg`–`p4_Im0.jpg`); drop new photos in alongside them and point the relevant file at the new filename.

### 3. Journey — chapters

**[content/chapters.ts](content/chapters.ts)** is the single source of truth for the journey (the `/story` page). The five chapters are the five tabs of the glass window on desktop.

```ts
export const journeyChapters: readonly JourneyChapter[] = [
  { title: 'It started with a wedding', paragraphs: ['They met at a wedding.', /* ... */] },
  // ...
];
```

- **Words**: edit a chapter's `title` (the tab label) and `paragraphs` (one string per paragraph). These are the client's final copy.
- **Film**: each chapter has an empty film slot. To fill it, put the file in `public/video/` and add `video: '/video/your-file.mp4'` to the chapter. Until then the slot shows "Film coming soon".
- **Photos**: for now they are crops of the design mockups, in `public/img/scenes/journey/standin/` (`ch<chapter>_<n>.jpg`), laid out as in the mockups. They are listed in `config/scene-layers.generated.ts`, which is written by `scripts/design/prepare_assets.py`; don't edit that file by hand. When the real photos arrive, ask for the collage layout to be updated.
- **Where things sit in the window** (text block, film slot per chapter): `config/journey-layout.ts`.
- **Number of chapters**: the window has exactly five tabs, so adding or removing a chapter also needs a new glass frame from the design mockups.
- **Phones** don't show the window. Their photocards (`chapters`, `stories`, at the bottom of the file) are derived from the same chapters, one card per paragraph, so there is only one copy of the words to edit. Don't hand-edit that derived part.

### 4. Wedding page tabs

Each tab under the wedding panel (`components/site/wedding/*Tab.tsx`) pulls from its own content file:

| Tab | Content file | Shape |
|---|---|---|
| Details (schedule/venue) | [content/wedding.ts](content/wedding.ts) | `daySchedule: ScheduleStop[]` (time, label, icon), `timelineIntroLines: string[]`, `venueAddressLines: string[]` |
| Motif / attire | [content/motif.ts](content/motif.ts) | `motifGroups: MotifGroup[]` — each has a `note`, colour `swatches`, and attire `samples` |
| Entourage | [content/entourage.ts](content/entourage.ts) | `entourageGroups: EntourageGroup[]` — `{ role, names[] }`; unfilled roles use `'—'` |
| FAQ | [content/faq.ts](content/faq.ts) | `faqEntries: FaqEntry[]` — see below |
| Intro verse cycler | [content/verses.ts](content/verses.ts) | `verses: Verse[]` — `{ text, ref }`, natural case (CSS applies the uppercase look) |

#### FAQ — special case: the design-credit entry

Most FAQ entries are plain `{ question, answer }` and can be edited directly in `content/faq.ts`. One entry is special:

```ts
{ question: 'Who designed the invitation and this site?', isDesignCredit: true },
```

This entry has no `answer` field — just a flag. Its content is split across two files:

- **Question text** → edit directly in [content/faq.ts](content/faq.ts) (last entry in `faqEntries`).
- **Answer text** (the actual credit blurb, with an embedded link to `chaodesign.ph`) → hardcoded as JSX in [components/site/wedding/FaqTab.tsx](components/site/wedding/FaqTab.tsx), inside the `{'isDesignCredit' in entry ? (...) : (...)}` block. It's done this way because the answer needs a clickable link mid-sentence, which a plain `answer: string` field can't express.
- **The link URL itself** → `siteConfig.chaodesignUrl` in `config/site.ts`, not in either of the above.
- The trailing `<i>Placeholder wording — swap for her own.</i>` in `FaqTab.tsx` is a marker for draft copy — delete it once real wording is supplied.

### Quick reference — "I want to change..."

| I want to... | Edit this file |
|---|---|
| A page/section background image | `config/site.ts` → `backgrounds`, plus the image file in `public/img/` |
| The journey words, or a chapter's film | `content/chapters.ts` |
| The journey photos and layout | `public/img/scenes/journey/standin/`, `config/journey-layout.ts` |
| Wedding schedule, venue address | `content/wedding.ts` |
| Attire / motif colours | `content/motif.ts` |
| Entourage names/roles | `content/entourage.ts` |
| FAQ questions/answers | `content/faq.ts` (design-credit answer is in `FaqTab.tsx` instead — see above) |
| Bible verses in the intro | `content/verses.ts` |
| Couple names, wedding date, venue, audio, Instagram link | `config/site.ts` |

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # generate Next.js types, then tsc --noEmit
npm run check:setup  # check local configuration without exposing secrets
npm run test         # Vitest, unit tests
npm run test:db      # Vitest, database integration tests (needs test DB)
npm run format       # Prettier
```
