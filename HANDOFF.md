# Handoff — Kliff & Chao wedding site

## Latest update — 26 October 2026: the desktop redesign is built (not pushed)

Steps 0–7 of `docs/REDESIGN_PLAN.md` are done on `redesign/monitor`: assets, scene engine,
gate and dive, terminal + intro, journey, wedding and the cleanup. Nothing is pushed, and
the production migration `rsvp_deliveries` is still unapplied, so **don't push or deploy
until it is**. What's left is review and the checks below, not building.

### How it fits together
- **Wide screens** (`/story`, above 768px) run the scene engine: `components/site/scene/`.
  `DesktopStory` composes `Terminal`, `IntroScene`, `JourneyScene`, `WeddingScene`;
  `transitions.ts` holds the scene-to-scene animations; `SceneProvider` owns input (wheel via
  GSAP Observer, swipe, keys), the lock while a move plays, and the nav capsule's glide.
  The rules (what a scroll does, nav jumps, tabs) are the pure state machine in
  `lib/scene/machine.ts`; camera maths, gestures and the terminal's progress curve are there too.
- **Phones** (≤768px) keep the stacked story: `StackedStory` + the old panels. Their journey
  photocards are derived from `content/chapters.ts`, so there is one copy of the words.
- **Gate:** `GateScreen` keeps the password check and audio handshake and renders both
  `MobileGate` and `DesktopGate`; desktop dives into the monitor and pushes
  `/story?arrival=gate`. `/story` reads that flag once (terminal plays) and strips it; any other
  arrival (cookie, reload, back from RSVP) gets a short intro entrance.
- **Assets:** `python scripts/design/prepare_assets.py` (about 90 s) writes
  `public/img/scenes/<scene>/`, `public/video/to-wedding.mp4` and
  `config/scene-layers.generated.ts`. Screen 01 is cut from `docs/design/v3/01-plate-clean.jpg`.
  Don't hand-edit the generated file. `prototype-v3/` and its assets are frozen references.
- **Content:** journey words in `content/chapters.ts` (final copy), per-chapter layout in
  `config/journey-layout.ts`, terminal copy in `content/terminal.ts`. Photos are still
  stand-ins cropped from the mockups; each chapter has an empty film slot (`video` field).
- Removed: the pinned horizontal track, the desktop coverflow and chapter arrows, and the
  scroll maths only they used. (Older notes below that mention `HorizontalTrack` are history.)

### Testing locally without real secrets
Run `next dev` with `SESSION_SECRET`, `SESSION_EPOCH` and a throwaway `SITE_PASSWORD_HASH`
in the process environment (hash made with `npm run hash-password -- <test password> --vercel`).
In that env value escape each `$` as `\$` (Next expands `$` like dotenv does), or the hash
silently stops verifying. In this session's preview pane, screenshots are cropped at scale 1
(use 0.5), and native `scroll` events don't fire, so drive scroll-based code with synthetic events.

### Not yet checked
- A real Vercel preview, including the Preview database isolation (guest search for "Kho"
  should return the synthetic Kho Family).
- A real iPhone: the audio handshake on the phone gate (unchanged, but never re-verified).
- Reduced motion on the desktop scenes (code paths exist: crossfades, no typing, no glitch).
- Performance on a mid-range laptop: screen 03 is about 20 layers plus the 11.8 MB film.
- Portrait/tablet widths (769-1024px) crop the sides of the 16:9 scenes.

### Known rough edges
- The arrival (terminal) takes about 25 s with no way to skip it; consider a skip.
- `AudioProvider.playMutedSync` doesn't catch the `play()` promise, so a wrong password logs an
  unhandled `AbortError` (harmless, older than the redesign).
- The intro film plate (`intro-web.mp4`) looks soft inside the blob; the original is wanted.
- Production's `DATABASE_URL` still has no `sslmode` (separate from the redesign).

## Earlier update — 26 October 2026: redesign step 0 done (not pushed)

**Read `docs/REDESIGN_PLAN.md` first.** It holds every decision (section 1), the
prototype → component mapping (4), the approach (6), the step table (7) and the open
items (9). The project is porting a new desktop design (the "monitor" prototype,
screens 01–05) into the live site. The phases in `docs/BUILD_PLAN.md` are finished;
this is new work on top of them.

### Where things are

- **Work in `Downloads/projects/kliffandchao` only.** The duplicate at
  `Downloads/new website/kliffandchao` is stale; don't use it.
  `Downloads/new website/` holds the prototype's original source and the original
  mockups; everything needed is now copied into this repo.
- **Branch `redesign/monitor` is checked out.**
  - Local `main`: ten Phase 7 commits (`418e8aa`…`49cd52d`), then the merge of
    `origin/main` (`a3c73c5`, clean).
  - `redesign/monitor` adds `2cc428a` (the plan doc).
- **Nothing is pushed.** `origin/main` is at `d365d0a`; local `main` is 11 commits
  ahead. Production deploys from GitHub, so nothing new is live.
- **Last full `npm run verify`:** green on `2cc428a` (lint, typecheck, 164/164 unit
  tests). DB integration tests weren't run this session.

### Step 0: what's done

- **Pending work committed in small steps.** Prettier pass, Node 24, hash-password,
  check:setup/verify, test-DB isolation, durable deliveries, backgrounds config, Lenis
  scope, reduced-motion fix, docs. Before committing, these were dropped (all backed
  up):
  - the user's test copy edits in `chapters.ts`;
  - the `.env*` line in `.gitignore`;
  - `intro2.jpg`, identical to the old `intro.jpg`;
  - a local boat-photo swap of `intro.jpg` (that photo is still on `origin/kliff` as
    `screensaver.JPG`).
- **`origin/main` merged.** `public/img/intro.jpg` is now **Chao's hill-and-monitor
  plate: a clean screen-01 background with no text and no pill** (1858×1045). That
  matters for redesign step 1. `origin/kliff` was deliberately left unmerged.
- **Vercel Preview isolated from production** (details below).

### Step 0: uncommitted work on `redesign/monitor` (finish this first)

- **`docs/design/v3/`** (17.4 MB): the mockups renamed to kebab-case, with the four
  PNGs converted to JPEG (quality 92, no chroma subsampling; PSNR 47–54 dB, so
  visually lossless). Also `transitions.txt`, `transition-04-05-flythrough.mp4`
  (was `1.mp4`), `walkthrough-fast-forward.mp4`, and a `README.md` index mapping
  every file to its original name.
- **`prototype-v3/`:** `index.html`, `app.js`, `styles.css`, `assets/` (44 files,
  4.9 MB, including `fly.mp4` and `manifest.js`), `serve.py` (copied from
  `prototype/`), `README.md`.
  - Run it with `python prototype-v3/serve.py` and open `http://localhost:4321`;
    confirmed working.
  - Dev shortcut: `?scene=2`…`5` jumps to a screen and exposes `window.proto.go12`
    etc.
- **`prototype-v3/` excluded from tooling,** the same four places as `prototype/`:
  `tsconfig.json` exclude, `eslint.config.mjs` globalIgnores, `.prettierignore`, and
  the `vitest.config.ts` exclude (Prettier-formatted after the edit).
- **`scripts/design/prepare_assets.py`:** the asset pipeline, moved from the
  prototype's `tools/`.
  - Reads `docs/design/v3/` (the new filenames), writes `prototype-v3/assets/` by
    default, takes `--out DIR`, copies the fly-through to `fly.mp4`, and uses
    `Image.Resampling.LANCZOS`.
  - Python 3 with numpy, scipy and Pillow; takes about 3 minutes; not part of the
    build.
  - **Tested on 26 October** with
    `python -W error::DeprecationWarning scripts/design/prepare_assets.py --out <tmp dir>`.
    It exited cleanly, wrote 44 files, and its `manifest.js` has the same 47 layers as
    `prototype-v3/assets/manifest.js`. The largest position shift is 0.07% of the stage
    (about 1 px), from the JPEG inputs. The committed `prototype-v3/assets/` were left
    as they were.

### Step 0: still to do, in order

1. ~~Confirm the pipeline test run~~: done (above).
2. **Update the spec tables** (the user asked for this):
   - **`CLAUDE.md`, "Where the specs live":**
     - `prototype-v3/` + `docs/design/v3/` win on **desktop** visuals.
     - `docs/REDESIGN_PLAN.md` is the redesign plan.
     - `prototype/index.html` stays the visual reference for **mobile** until portrait
       designs exist.
     - Extend "Don't edit `prototype/`" to `prototype-v3/`.
   - **`docs/PLAN.md`:** the precedence note in the header.
   - **`docs/BUILD_PLAN.md`:** the precedence paragraph, plus the "Repo layout" tree
     (add `prototype-v3/`, `docs/design/v3/`, `scripts/design/`,
     `docs/REDESIGN_PLAN.md`).
3. Mark step 0 done in `docs/REDESIGN_PLAN.md`: section 7, and section 9 item 3 (the
   folder layout is decided).
4. `npm run verify`, then small commits on `redesign/monitor`. Suggested split:
   - `docs(design): add the v3 mockups, motion spec and videos`
   - `chore: add prototype-v3 as a reference and exclude it from tooling`
   - `chore(design): add the asset pipeline`
   - `docs: point the spec table at prototype-v3`, including the plan status

   **Don't push.**
5. **Stop and report.** `CLAUDE.md` says to stop at the end of each step. Step 1
   (assets) is next and needs a go-ahead.

### Vercel environment (changed 26 October)

- **Preview** now has its own:
  - `DATABASE_URL`: the `kliffandchao-test` pooler
    (`aws-0-ap-southeast-1.pooler.supabase.com:6543`, user
    `app_test_runner.yplulqnwnlkuzemkebjv`, `sslmode=no-verify`);
  - `DIRECT_URL`: the test project's direct host;
  - `COUPLE_NOTIFY_EMAIL=delivered@resend.dev` (Resend's test inbox);
  - `GOOGLE_SHEET_ID=preview-no-sheet` (the Sheets mirror and "Sync now" fail safely).
- **Production and Development are unchanged,** and `RESEND_API_KEY` is still shared.
- **Not yet confirmed on a live preview:** on the first redesign preview, guest search
  for "Kho" should return the synthetic Kho Family. Previews deployed before 26 October
  still use production until they're redeployed.
- **To split a variable that's shared across environments:**
  `vercel env remove NAME --environment preview --yes`, then
  `vercel env add NAME --environment preview --sensitive < file`.
  **Never use `vercel env update` on a shared entry: it rewrites every environment it
  covers, production included.**

### Still open, outside step 0

- The `rsvp_deliveries` migration is **still not applied to production**. It must be
  applied (`npm run db:deploy` against production, deliberately) before local `main`
  is pushed or deployed.
- Production's `DATABASE_URL` has no `sslmode`, so the app's connection to the Supabase
  pooler is unencrypted. This is a separate fix, not done.
- `README.md` doesn't mention the redesign yet. Add it when the redesign lands.

### Hard-won this session

- **`origin/main` can move under you.** Fetch before merging. `d365d0a` appeared mid-step
  and changed which `intro.jpg` won the merge.
- **Line endings:** `core.autocrlf=true`. Some working files are CRLF (`README.md`,
  `HANDOFF.md`, `docs/BUILD_PLAN.md`); the repository stores LF. Normalise before
  comparing file contents.
- **Prettier run on files outside the repo ignores `.prettierrc`** (it switched
  everything to double quotes). Pass `--config .prettierrc`.
- **Splitting one file across commits without `git add -p`:** build the in-between
  content, then run `git hash-object -w --path=<file> <tmp>` and
  `git update-index --cacheinfo 100644,<blob>,<file>`.
- **Hidden preview pane:** rAF and timers are throttled, and scripts that await rAF
  hang. To check a transition, pause every Web Animation and set `currentTime`, then
  take screenshots. Screenshots force frames.
- **Leftover `filter` values:** a committed `filter: blur(0px)`, which WAAPI's
  `commitStyles()` writes instead of `none`, switches off `backdrop-filter` inside that
  element. Remove the property after the animation.
- **Backups of everything dropped in step 0** are in this session's scratchpad
  (`step0-backup/`: the patch of the dropped edits, `intro2.jpg`, and a tar of all 58
  pre-step-0 files). The scratchpad is temporary and may not survive the session. The
  only content not also in git is the two test copy edits.

---

## Earlier update — 25 October 2026 (now committed)

**Latest follow-up: fixed the laptop-specific reduced-motion layout bug.** The user confirmed Windows Accessibility → Visual effects → Animation effects is off. Reproduced with a desktop browser emulating `prefers-reduced-motion: reduce`: JS disabled the pinned track but CSS still placed the three sections horizontally, so all section tops were zero, the scroll spy chose Wedding, the verse received an offscreen parallax offset, and Journey selected its last story.

`lib/track/layout.ts` and `components/site/useStoryLayout.ts` now share the desktop/mobile/reduced-motion decision across HorizontalTrack, JourneyPanel, and Coverflow. CSS stacks unpinned sections for reduced-motion desktops too, the carousel uses its native scroll rail in that mode, and parallax transforms are disabled. Native section detection uses viewport rectangles instead of offset-parent positions. Reduced-motion navigation is immediate and has no forced idle snap; the existing animation-enabled desktop experience remains horizontal. Layout preference changes reload cleanly, as breakpoint changes already did. No Windows settings were changed.

Verified the local gate, initial Intro selection, visible verse, section navigation, and native chapter navigation in temporary Edge contexts: desktop normal/reduced, mobile normal/reduced, and exactly 768px. A live motion-preference toggle also passed. Screenshots saved in this chat's visualization directory (`reduced-motion-intro-fixed.png`, `reduced-motion-journey-fixed.png`). `npm run verify` passed: lint, type checking, and **164 unit tests** (four new layout combinations). Temporary browser harness removed. Reused the user's existing port-3000 dev server and left it running. No database writes, commit, push, or deployment in this follow-up.

**Follow-up: native database testing is now configured and passed.** The user connected Supabase, chose the `kliffandchao` organization, and explicitly approved the scoped test login and its permissions. Created separate project `kliffandchao-test` (`yplulqnwnlkuzemkebjv`, Singapore); production remains `iibxpudrhuruymcnzoio` and was not changed. The non-superuser `app_test_runner` login exists only in the test project with CONNECT/CREATE on that database and USAGE/CREATE on public. Its random password is stored only in gitignored `.env.test`; do not print it. Full TLS verification uses the public CA in `config/supabase-ca.crt` (downloaded from Supabase's certificate bucket, expires April 2031).

`npm run db:prepare-test` safely applies repository migrations and seeds synthetic households in the separate database. `scripts/test-database-env.ts` shares fail-closed target checks with Vitest and converts the CA URL options for Prisma's migration engine. All four migrations applied successfully, a repeat preparation had no pending migrations, and all **16 database integration tests passed**. Fixed the new delivery tests' cleanup to delete response rows before submissions; the three leftover synthetic households from the first failed cleanup were removed by their exact ids. RLS is enabled on Prisma's internal `_prisma_migrations` table too. `.env.test` now intentionally remains configured for this separate project, superseding the old "no .env.test left behind" note below. The production migration, deployment, commit, and push remain pending.

Post-test checks confirmed exactly six synthetic parties and 20 guests, no remaining submissions/responses/current answers/delivery jobs or temporary delivery-test households, and RLS on all eight public tables. Supabase's no-policy INFO notices match the deliberate backend-only access model. The security advisor still flags `pg_trgm` and `fuzzystrmatch` in public ([extension placement guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)); this mirrors the repository's existing migration and was not changed as part of setting up a faithful test database.

Final follow-up verification passed: lint, type checking, **160 unit tests**, and the **16 native PostgreSQL integration tests**. The test login was verified to have no superuser, role-creation, database-creation, or BYPASSRLS attributes. Temporary setup/cleanup scripts were removed; only the reusable preparation/environment helpers and public CA remain.

The notes below this section describe the earlier state. The user has since requested the architecture improvements discussed in this chat.

- Added durable `RsvpDelivery` records in the RSVP transaction, Next.js `after()` processing, admin delivery status/retries with pagination, atomic claims with five-minute leases, snapshotted email payloads and Resend idempotency keys. Email retries require review after 23 hours to stay inside the provider's 24-hour key retention window.
- Sheets mirroring now reserves fixed row ranges through `SheetMirrorCursor` and uses PUT rather than append. Retrying a lost response reuses its original range. Occupancy/moved-row checks stop unsafe writes. `RSVP_Log` must remain an application-managed log; use another tab for sorting. Existing log rows are retained.
- **Migration `20261025000000_rsvp_deliveries` is prepared but has NOT been applied to the real database. Apply it to the intended database before running/deploying this updated app.** It adds two tables, enums, indexes, a foreign key, and RLS on both tables. No existing submissions are backfilled or resent. No production deployment, commit, or push was performed.
- Node 24 is declared in package engines and `.nvmrc`, with early install enforcement. `npm run typecheck` generates Next.js types first. `npm run check:setup` validates local configuration without printing secrets. The password command now works outside Next's bundler and outputs an already-escaped local assignment by default (`--vercel` outputs a raw value). The local login failure was confirmed to be Next.js expanding unescaped `$` characters in `.env.local`; those were fixed locally.
- All background paths now live under `config/site.ts` → `backgrounds`. Lenis is scoped to the story layout; audio stays in the root layout so it survives navigation. Coverflow now agrees with the other mobile checks at exactly 768px. Shared-password identity and publicly served media remain the deliberate existing workflow choices.
- `npm run verify` passed with **155 unit tests** and the production build passed. The new migration also matched Prisma's schema diff and all migrations applied successfully to an isolated PGlite PostgreSQL instance with both new RLS flags confirmed. **The database integration suite is not verified:** PGlite's socket adapter closed connections during transaction/concurrency tests. A native separate PostgreSQL test database is still needed. Temporary test files/server were cleaned up; real data was never used for these tests.
- Database tests now require an explicit `TEST_DATABASE_URL` in `.env.test` and reject the configured application database instead of falling back to `.env.local`. This closes the old pre-production assumption in the test config. No `.env.test` is left behind.
- Existing user edits to `.gitignore`, `content/chapters.ts`, `public/img/intro.jpg`, and the added `public/img/intro2.jpg` were preserved. Do not commit those automatically with the architecture changes.

Written because context ran out mid-project, again. Read this before doing anything else; it's current as of commit `77bc1d2`, working tree clean (only this file untracked).

## Where things stand

**Phases 0–6 are done and pushed to `main`.** Phase 4 (frontend port) was done step-by-step (see commits `efb0189`/`35aa0fd`/`e6b74b9`). Then a long run of user-reported bug fixes (gate keyboard, journey text color, mute icon, desktop scroll, mobile nav/parallax stuck, RSVP crash on desktop, journey layout gap, RSVP dropdown not closing — all pushed, see `git log`). Then:

- **Phase 5 (`623296e`): Admin dashboard.** Supabase Auth email+password login, `requireAdmin()`/`requireAdminApi()` (session + `ADMIN_EMAILS` allowlist — `lib/auth/admin-allowlist.ts`), `/admin` stats + guest table, `/admin/parties/[id]` history, `proxy.ts` extended to cover `/admin/:path*` the same redirect-UX-only way it covers the guest gate.
- **Phase 6 (`531b952`, plus fixes `4f9405d`/`46f6ceb`): Sheets sync.** `lib/sheets/{client,escape,retry,mirror,read-guests}.ts`, `app/api/sync/route.ts` (Apps Script webhook), `app/api/admin/sync/route.ts` ("Sync now" full pull), `lib/guests/upsert.ts` (shared by the sync routes **and** `prisma/seed.ts` — don't let these drift apart again). `google-auth-library` added as a dependency (JWT auth, raw `fetch` to the Sheets REST API — not the full `googleapis` SDK, per `BUILD_PLAN.md`'s own stack choice).

**Phase 7 (Hardening) in progress — error/empty states done, rate limiting deliberately deferred.** Not started: Phase 8 (Launch).

- User chose to defer Upstash rate limiting post-launch (per `PLAN.md`'s own "defensible to skip" framing — scrypt already costs ~80ms/attempt) rather than add `@upstash/ratelimit` + a new external account before launch. Turnstile also skipped — no abuse has appeared.
- Added `app/error.tsx` (glass-styled, root boundary for the guest-facing gate/journey/wedding/RSVP tree) and `app/admin/error.tsx` (plain shadcn-styled, covers the direct Prisma calls in `app/admin/page.tsx` and `app/admin/parties/[id]/page.tsx`). Neither renders `error.message` to the client.
- Fixed three unguarded `await fetch(...)` call sites that had no `try/catch` around the network call itself (only `!response.ok` was handled) — an offline guest would otherwise get stuck on "Loading…"/a spinning submit button forever with zero feedback: `components/site/gate/GateScreen.tsx`'s `submit()`, and `app/(gated)/rsvp/page.tsx`'s `handleSelectGuest()` and `handleSubmit()`. `components/rsvp/GuestSearch.tsx` already handled this correctly — used as the reference pattern.
- Guest search's existing "no results" vs "something went wrong" distinction (`GuestSearch.tsx` lines ~100-103) was already built in Phase 4 — nothing to do there.
- **Verification note:** this sandbox's `DATABASE_URL` genuinely can't reach the real Supabase Postgres host (`Can't reach database server at db.iibxpudrhuruymcnzoio.supabase.co`, confirmed via `/api/guests/search` returning a real 500) — not something this session broke. That incidentally proved the existing guest-search "failed" messaging already degrades gracefully against a real DB-down backend. But it also means `/admin` (which needs a real Supabase Auth session to even reach the Prisma call `app/admin/error.tsx` guards) couldn't be live-tested end-to-end here — no admin credentials in this session, and the real DB being unreachable blocks login anyway. The gate's offline-handling fix (`GateScreen.tsx`) *was* confirmed live: patched `window.fetch` to reject, submitted, confirmed it falls back to the normal wrong-password error state instead of hanging. `lint`/`typecheck`/`test` all pass (133 tests, same count — these are UI/integration fixes, not pure logic, so no new unit tests per `CLAUDE.md`'s testing policy).
- Noticed, did not fix (pre-existing, unrelated to this session's change): submitting a wrong password logs `Uncaught (in promise) AbortError: The play() request was interrupted by a call to pause()` to the console — `audio.pause()` racing the muted `play()` call started synchronously in `handleEnter`. Cosmetic console noise only, not user-visible. Confirmed present on a real 401 too, not something introduced by the offline-handling fix.
- Not done in Phase 7 yet: the "Done when" criterion in `BUILD_PLAN.md:411` ("killing `DATABASE_URL` on a preview shows a friendly error screen, not a stack trace") should still be re-verified on an actual Vercel preview deployment once one exists, since this sandbox's DB-unreachable state is incidental, not a deliberate `DATABASE_URL`-kill test, and `/admin`'s boundary specifically couldn't be exercised here.

## ✅ Resolved this session — Sheets auto-sync debugging

Was an active, unfinished task; **user confirmed it's now fixed**. Keeping the sequence here since the same failure modes will likely recur (different secret, different sheet, different deploy):

1. User reported: manual "Sync now" (full pull) worked, but editing a cell in the real `Guests` tab didn't save to the DB.
2. Found via `npx vercel logs https://kliffandchaov2.vercel.app --query "api/sync" --since 24h`: zero real webhook requests had ever reached the server (only my own manual test calls).
3. User's Apps Script `Executions` log showed a `TypeError: Cannot read properties of undefined (reading 'getLastRow')` — turned out to be a red herring: they'd run the `findHeaderRow` helper directly via the editor's **Run** button (which calls it with no arguments), not a real trigger firing. Not a real bug.
4. Had them actually edit a cell in the sheet and recheck Executions: trigger fired, **completed without error** — but `vercel logs` still showed nothing. This is the real clue: `UrlFetchApp.fetch(..., { muteHttpExceptions: true })` won't throw even on a 404, so "Completed" alone doesn't prove the request reached our route.
5. Asked for the exact `SYNC_URL` value in the script → found it was `https://kliffandchaov2.vercel.app/story/api/sync` — **an extra, wrong `/story` segment**. That 404s at Vercel's routing layer before ever hitting the function, which is exactly why it never showed in function logs.
6. Had them fix it to `https://kliffandchaov2.vercel.app/api/sync`, save, and edit the sheet again.
7. Executions showed `Completed`, and `vercel logs` now showed the requests actually reaching the server — but data still wasn't landing. Root cause, per the user: the Apps Script's own `SYNC_SECRET` constant didn't actually match the real `SYNC_WEBHOOK_SECRET` (it had been hand-typed into the script at some point and drifted). **Re-pasting the exact value fixed it.**

**Lesson for next time a sync/webhook "request reaches the server but nothing happens" report comes in:** check status code first (`vercel logs ... --json`), but go straight to "does the Apps Script's hand-typed secret constant actually match the env var, character for character" as the leading hypothesis — don't assume it was pasted correctly just because it was pasted at all. The two other usual suspects (wrong URL, wrong target function) also both happened this exact session, so check all three every time.

## 🔴 Known data gap in the real spreadsheet — not yet resolved

The real `Guests` tab (not a toy sheet — their actual 216-guest tracker) has structural quirks `parseGuestRows`/`parseGuestsSheetValues` now handle, but one **data** gap remains the user's to fix, not code's:

- Header row is **not** row 1 — there's a 13-row dashboard summary above it; the header (with the couple's own tracking columns *and* our required ones mixed together) is wherever the row containing literal `guest_id` is (currently row 14). Code handles this generically now (`lib/sheets/read-guests.ts`'s `findHeaderRowIndex`).
- `side` is mapped from their existing `Guest Of` column (values were already exactly `KLIFF`/`CHAO`/`BOTH` — just needed the header cell renamed, no data change).
- `notes_private` was added as a new, blank column.
- **~55 of 216 rows are still missing `last_name`** — mostly placeholder plus-ones like `Guest Name = "Che Tanate - Husband"` with `first_name = "Husband"` already filled in but no surname. This blocks `POST /api/admin/sync` (the full pull) entirely, since it refuses to archive-everyone on a sheet that doesn't fully parse — **but it does NOT block the per-row webhook sync** (`POST /api/sync`), since that only ever processes the specific row(s) Apps Script sends, which `parseGuestRows` validates independently per request. So: editing one of the ~55 broken rows via the webhook would 400; editing any of the other ~161 good rows should sync fine regardless of the other 55 being broken. Keep this distinction in mind when diagnosing — "sync is broken" might really mean "that one specific row they edited happens to be one of the 55."
- I offered to bulk-fix by reusing the named guest's own surname for these placeholder rows (e.g. `Tanate` for "Che Tanate's Husband"), but explicitly **did not do it without their go-ahead** — it needs human judgment per row. Still outstanding; they have not yet responded to that offer.

## Vercel env var gotchas — hit this twice already, will hit again

**`.env.local` changes never propagate to Vercel automatically.** This caused two separate "it works locally but not in production" bug reports this session (admin login failing — stale `NEXT_PUBLIC_SUPABASE_ANON_KEY`; Sheets sync failing — stale `GOOGLE_SA_KEY_B64`/`GOOGLE_SHEET_ID`/`SYNC_WEBHOOK_SECRET`). **Any time the user says "I updated X locally" and later reports a production bug touching that same var, check Vercel's copy first** via:
```bash
npx vercel env ls production
```
Timestamps unchanged since the initial Phase-0 placeholder batch (`1d ago`, or whatever "really old" reads as by the time you're reading this) is the tell.

**How to safely push a real secret value to Vercel, without corruption:**
- ❌ `$value | npx vercel env add NAME production` — PowerShell's pipe-to-external-process encoding silently prepended a UTF-8 BOM to the value in this environment, corrupting it by 3 bytes while looking identical in the dashboard. Took two failed attempts (first with plain pipe, second even after setting `$OutputEncoding = New-Object System.Text.UTF8Encoding $false`, which did *not* fix it) before finding a reliable method.
- ✅ Write the value to a temp file with explicit no-BOM encoding, then feed it via `cmd.exe`'s native redirection (bypasses PowerShell's pipe entirely):
  ```powershell
  $noBomUtf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($valueFile, $value, $noBomUtf8)
  cmd /c "npx vercel env add NAME production --type config < `"$valueFile`""
  ```
  Verify byte-for-byte after: pull the var back (`vercel env pull`, only works for `--type config`, not `secret`) and compare lengths/exact match against the local source. **Always verify this way after any push — don't trust the dashboard preview string**, which turned out to be a meaningless fixed placeholder (`eyJ2IjoidjIiLCJjIj…`) shown identically for *every* Config-type var regardless of actual content.
  - `Secret`-type vars (the default for non-`NEXT_PUBLIC_` names) can't be pulled back at all (`vercel env pull` writes `[SENSITIVE]` placeholders for them) — can't verify byte-for-byte the same way; just be extra careful with those.
- Vercel CLI 62.2.0 requires an explicit `--type config` or `--type secret` flag for any `NEXT_PUBLIC_`-prefixed var (refuses to guess). Use `config` for the two allowed public vars (`NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`) — they're meant to be exposed to the browser. Non-`NEXT_PUBLIC_` vars default to `Secret` and that's correct, don't override it.
- **`NEXT_PUBLIC_*` vars are inlined at Next.js build time** — after changing one on Vercel, you must trigger a **new deployment**, not just wait. `npx vercel redeploy <deployment-url> --target production` rebuilds without needing a new git push. Server-only vars (read at runtime) don't strictly need a redeploy, but redeploy anyway for safety/consistency.
- `npx vercel logs <url> --query "..." --since <Nh|Nm> -n 100 --json` is the fastest way to check whether a specific request actually reached a route, and will be useful again for any future "works locally, not in prod" report.
- Always clean up temp value files (`Remove-Item $valueFile -Force`) right after use — they contain raw secrets.

## Safe-testing patterns established this session

- **Never print a real secret value directly in a shell command or tool-call argument** — PowerShell variables read *inside* the script (file reads, piping) don't leak into the visible command text; a literal secret pasted into a `--value "..."` argument would.
- **Testing API routes that need a real secret** (webhook endpoints, etc.): read the value from `.env.local` into a PowerShell variable, use it in a `curl.exe -H "x-header: $secretVar"` call — never echo the variable itself.
- **Testing DB-touching scripts**: standalone scripts (not going through Next's bundler) can't import anything with `import 'server-only'` at the top — it throws unconditionally outside a bundler. Write throwaway scripts under `scripts/tmp-*.ts` using a standalone `PrismaClient` + `DIRECT_URL` (same pattern as `prisma/seed.ts`), run via `npx tsx --env-file=.env.local scripts/tmp-whatever.ts`, and **always delete the script immediately after** (`git status --short` should come back clean of it). Did this repeatedly this session for: testing `/api/sync` end-to-end against the real DB, inspecting the real spreadsheet's structure read-only, and cleaning up test guest/party/submission rows afterward.
- **Test guest data created during verification must be cleaned up** — did this for a `g_test_sync`/`p_test_sync` pair (local) and a `g_test_prod_sync`/`p_test_prod_sync` pair (production) and a `test-phase6-mirror-check-001` RSVP submission (plus its `GuestRsvp` rows). If you create more test data while debugging, clean it up the same way before ending the task.
- **The preview browser tool can't attach to an already-running external dev server** (tried adding a `"url"`-only entry to `.claude/launch.json` — `preview_start` explicitly rejected it: "needs the in-app Browser preview — not enabled on this install"). If port 3000 is taken by the user's own `npm run dev`, either ask them to close it, or fall back to `curl`/PowerShell for verification instead of the browser tool.
- Guest gate test password: `KliffAndChao` (whitespace/case-insensitive per the normalization rules). Real seeded test household: search "Kho" → Kho Family (Benjamin, Imelda, Ramon). **Note: the real production DB now also has 216 real synced guests from "Sync now"** — don't confuse seed data with real guest data when testing against production.
- Admin login now has a real working Supabase Auth user (user confirmed "I can actually login" after the anon-key fix) and `ADMIN_EMAILS` has exactly one real email configured.

## Working agreement (from CLAUDE.md, the load-bearing bits)

- **One phase/step at a time, stop and report after each.** The user says "proceed with next phase" to continue; don't start the next phase unasked. (Phases 5 and 6 both followed this — asked about new dependencies and the push-now-or-wait decision each time, per CLAUDE.md's "ask before adding a dependency" and the general care-with-irreversible-actions guidance.)
- **Commit/push only when asked** — though by this point in the project the user asks for it almost every turn; still don't assume for a turn that doesn't mention it.
- **Prototype wins on visuals; BUILD_PLAN.md wins on data/RSVP/admin/sync.** Hasn't come up again in Phase 5/6 (no visual spec exists for admin — deliberately built as a plain, generic UI using the shadcn/base-ui primitives already in `components/ui/`, not the wedding's glass aesthetic, since `app/admin` must stay reusable/non-wedding-specific per the reusability split table).
- **Never edit `prototype/`.**
- Run `lint`, `typecheck`, `test` before calling anything done — all three have stayed green all session (133 tests as of the last full run, up from 99 at session start).

## Hard-won bugs from earlier sessions — don't reintroduce these

1. **`requestAnimationFrame` can be suspended indefinitely** in a backgrounded tab *or* this session's embedded Claude Browser preview pane. The scene engine's timed sequences guard with `setTimeout` (`playToEnd`, `sleep`) for the same reason; the old `HorizontalTrack` did too.
2. **`<body>{display:flex}` silently breaks GSAP's pin-spacer sizing.** Stays removed; see the comment on `<body>` in `app/layout.tsx`.
3. **"Run exactly once" guards must flip their flag *after* the async step resolves, not before** (React Strict Mode's dev-only mount→cleanup→remount runs cleanup synchronously before any promise settles).
4. **Tailwind's utility layer sits below plain unlayered CSS.** `.glass`/`.glass-light` in `globals.css` will beat any Tailwind utility class regardless of specificity. Use inline `style` to override one side of what `.glass` sets.
5. **The preview harness's hidden-tab state freezes CSS animations and `scrollTo({behavior:'smooth'})`.** This bit the mobile-scroll-snap fix this session too — `window.scrollTo({behavior:'smooth'})` silently did nothing in the preview pane until a screenshot forced a repaint; confirmed via `getComputedStyle`/direct DOM reads that the underlying logic was correct, not a real bug. Don't chase this as a regression; force a repaint (screenshot call) before concluding something's actually stuck.
6. **Apps Script's `UrlFetchApp.fetch(..., {muteHttpExceptions: true})` reports "Completed" even on a 404/401/500.** Don't trust "no error in Executions" as proof a webhook actually succeeded — always cross-check `vercel logs` (or equivalent server-side logs) for the real response.
7. **Apps Script's installable trigger function ≠ whatever's in the editor's own Run-button dropdown.** Manually clicking Run tests whatever function that dropdown happens to show, called with zero arguments — a helper function expecting a real event object (`e`) will throw in a way that looks like a real bug but isn't. Only a genuine spreadsheet edit exercises the real trigger path.

## Architecture notes specific to this codebase

- **`TrackProgressProvider`** bridges the story's scroll engine (the scene engine, or the phone's stacked sections) to everything outside that subtree. Extend this, don't invent a second channel.
- **`app/admin/` has no shared gated layout** — `requireAdmin()` is called directly in `app/admin/page.tsx` and `app/admin/parties/[id]/page.tsx` individually (not a layout), specifically so `/admin/login` can stay outside any auth gate. If you add more admin pages, follow the same direct-call pattern rather than introducing a layout that would need to carefully exclude `/login`.
- **`lib/env.public.ts` exists specifically so `lib/supabase/client.ts` (browser-side) can read the two `NEXT_PUBLIC_*` vars without pulling in `lib/env.ts`'s `import 'server-only'` guard**, which throws unconditionally if bundled client-side. If you need another client-safe env var later, extend `env.public.ts`, don't import the main `env` object into client code.
- **`lib/guests/parse-rows.ts` and `lib/guests/upsert.ts` are shared by `prisma/seed.ts` AND the two Sheets sync routes.** Any change to guest-row validation/upsert logic affects all three call sites — check all of them, not just the one you're editing.
- **`lib/sheets/read-guests.ts`'s header-row detection is content-based** (searches for the row containing `guest_id`), not position-based, specifically because the real spreadsheet has a dashboard above the real table. Don't regress this back to assuming row 1.
- **Blank-row filtering in both `read-guests.ts` and the Apps Script checks `guest_id` specifically**, not "is every cell in the row empty" — Google Sheets' pre-allocated template rows (e.g. 1001 rows when only 216 have guests) aren't actually blank in every column due to stray dropdown/conditional-formatting defaults in the sheet's own extra tracking columns.
- **Every tab/panel in `WeddingPanel` stays mounted simultaneously** (CSS `display` toggle, not conditional rendering).
- **`components/rsvp/` is intentionally a sibling of `components/site/`**, not nested under it, per `BUILD_PLAN.md`'s layout.
- **`components/admin/` mirrors this split** — plain, non-wedding-themed UI (uses `bg-background`/`text-foreground`/etc. from the shadcn theme tokens already in `globals.css`, not the glass aesthetic).
- **Glass primitives**: `.glass`/`.glass-light` + `--glass-*` tokens in `globals.css`; `GlassWash` component for any blurred-photo-behind-glass need.
- **Pure functions added so far, all unit-tested**: `lib/track/{progress,coverflow}.ts`, `lib/wedding/countdown.ts`, `lib/admin/stats.ts`, `lib/auth/admin-allowlist.ts`, `lib/sheets/{escape,retry,mirror,read-guests}.ts`, `lib/guests/parse-rows.ts`. Keep following this pattern: pure decision logic in `lib/`, thin I/O wrapper taking `prisma`/`fetch` as an injected dependency (not importing the singleton directly) so it stays testable.

## Known deliberate deviations from the specs (already surfaced, don't re-litigate)

- **"MOTTIF" → "MOTIF"** typo fix, kept.
- **Journey's design is the prototype's glass coverflow, not `docs/PLAN.md`'s circular wheel** — superseded, built version is correct.
- **Audio file lives in `public/audio/`** despite `docs/PLAN.md` saying otherwise — user explicitly chose this.
- **Admin dashboard UI has no prototype/PDF reference at all** — built as a plain, generic UI by necessity (nothing to port from), using existing shadcn/base-ui primitives. Not a deviation exactly, just a gap in the specs that was filled with reasonable judgment.

## Verification limits, be upfront about these

- The Claude Browser preview pane cannot be trusted for timing-/compositor-dependent behavior (scroll-linked animation, `smooth` scroll, CSS keyframe entrances) — confirm logic via DOM state/`getComputedStyle` instead, and say the visual motion itself is unverified.
- No real iPhone in this loop, ever.
- **No direct access to the user's Google Apps Script project** — can only see what they paste back from the Executions log or the script's own constants. Ask precisely (exact error text, exact line, exact constant values) rather than guessing.
- **Real guest data lives in a real spreadsheet and a real production DB now** — Phase 5/6 are no longer "toy data" phases. Be extra careful with any script that writes/deletes; always scope to specific test-only `externalId`s you created yourself, never broad queries, when cleaning up after a verification step.

## Quick orientation for a fresh session

1. Read `docs/BUILD_PLAN.md` Phases 5–8 fresh if continuing forward; this file plus `git log` covers what's already built.
2. Check the 🔴 Active task section above **first** — that's almost certainly why context ran out, and it has an exact next command to run.
3. `npx vercel env ls production` before touching any "works locally not in prod" report — check timestamps first, it's been the answer twice already.
4. Production site: `https://kliffandchaov2.vercel.app`. Admin: `/admin/login` (real Supabase user exists, user has the password). Linked Vercel project via `.vercel/project.json`; CLI already authenticated as `nexusofdorne`.
