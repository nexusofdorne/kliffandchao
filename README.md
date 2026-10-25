# kliffandchao

Private, password-gated wedding website for Kliff & Chao (5 March 2027, Cebu).

See `docs/BUILD_PLAN.md` and `docs/PLAN.md` for the full architecture/design specs, and `CLAUDE.md` for the engineering rules this repo follows. This README is a practical guide to **where to edit content** — no code changes needed for anything below.

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

There is **no central backgrounds config** — each panel hard-codes its own image path inline. Edit the file directly:

| Page / panel | File | What to change |
|---|---|---|
| Intro video poster | [components/site/intro/IntroPanel.tsx](components/site/intro/IntroPanel.tsx) (~line 32) | `poster="/img/intro-poster.jpg"` (video itself is `src="/video/intro-web.mp4"`, line 31) |
| Password / gate screen | [components/site/gate/GateScreen.tsx](components/site/gate/GateScreen.tsx) (~line 88) | `src="/img/intro.jpg"` |
| Journey panel ambient background | [components/site/journey/JourneyPanel.tsx](components/site/journey/JourneyPanel.tsx) (~line 101) | `<Image src="/img/p1_Im0.jpg" .../>` |
| Wedding panel background | [components/site/wedding/WeddingPanel.tsx](components/site/wedding/WeddingPanel.tsx) (~line 39) | `<GlassWash imageSrc="/img/p1_Im0.jpg" />` |
| RSVP overlay background | [app/(gated)/rsvp/page.tsx](<app/(gated)/rsvp/page.tsx>) (~line 81) | `<GlassWash imageSrc="..." />` |

The actual image files live in **[public/img/](public/img/)** — anything under `public/` is served from the site root, so `/img/foo.jpg` in code = `public/img/foo.jpg` on disk. Currently only 6 placeholder files exist there (`intro.jpg`, `intro-poster.jpg`, `p1_Im0.jpg`–`p4_Im0.jpg`); drop new photos in alongside them and point the relevant file at the new filename.

### 3. Journey — chapters and stories

**[content/chapters.ts](content/chapters.ts)** is the single source of truth for the whole journey/coverflow section (`/story` page). Journey "content" is not separate from chapters/stories — it's all this one file.

```ts
export type Story = { image: string; caption: string; paragraph: string };
export type Chapter = { number: string; title: string; label: string; stories: Story[] };

export const chapters: Chapter[] = [
  { number: 'CHAPTER 1', title: 'WHERE WE MET', label: 'How we met', stories: [ /* ... */ ] },
  // ...
];
```

- **Number of chapters**: determined entirely by how many objects are in the `chapters` array (currently 5). Add or remove an object to add/remove a chapter — no other file needs to change.
- **Stories per chapter**: each chapter has its own `stories: Story[]` array (currently 3–5 per chapter, 19 total). Add/remove/edit objects inside a chapter's `stories` array to change its content.
- **Editing a story**: each `Story` is `{ image, caption, paragraph }` — change `image` to a new `/img/...` path (file must exist in `public/img/`), and edit `caption`/`paragraph` freely.
- **Do not hand-edit** the `FlatStory` type or `export const stories` block near the bottom of the file (~line 147 onward) — it's derived automatically from `chapters` via `.flatMap(...)` and recomputes itself whenever you change the `chapters` array.
- **Navigation updates automatically**: `ChapterStepper`, `ChapterArrows`, and `Coverflow` (all in `components/site/journey/`) all read from `chapters`/`stories` directly — a new chapter gets its own clickable dot/label with zero extra wiring. After adding/removing a chapter, do a manual scroll-through to sanity-check the scroll pacing in `lib/track/progress.ts`, which budgets scroll distance per chapter/story count.
- Per the code comment at the top of the file, only Chapter 1's title is real client-approved copy — the rest (titles, captions, paragraphs) are placeholders carried over from `prototype/index.html`.

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
| A page/section background image | The relevant component in `components/site/*` (see table above), plus the image file in `public/img/` |
| The journey/story photos or captions | `content/chapters.ts` |
| How many chapters there are | `content/chapters.ts` — add/remove entries in the `chapters` array |
| How many stories a chapter has, or a story's photo/text | `content/chapters.ts` — edit the chapter's `stories` array |
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
npm run typecheck    # tsc --noEmit
npm run test         # Vitest, unit tests
npm run test:db      # Vitest, database integration tests (needs test DB)
npm run format       # Prettier
```
