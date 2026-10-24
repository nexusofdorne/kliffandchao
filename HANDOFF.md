# Handoff — Kliff & Chao wedding site

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

1. **`requestAnimationFrame` can be suspended indefinitely** in a backgrounded tab *or* this session's embedded Claude Browser preview pane. `HorizontalTrack`'s pin setup retries via `setTimeout`, not rAF, for exactly this reason.
2. **`<body>{display:flex}` silently breaks GSAP's pin-spacer sizing.** Stays removed; see the comment on `<body>` in `app/layout.tsx`.
3. **"Run exactly once" guards must flip their flag *after* the async step resolves, not before** (React Strict Mode's dev-only mount→cleanup→remount runs cleanup synchronously before any promise settles).
4. **Tailwind's utility layer sits below plain unlayered CSS.** `.glass`/`.glass-light` in `globals.css` will beat any Tailwind utility class regardless of specificity. Use inline `style` to override one side of what `.glass` sets.
5. **The preview harness's hidden-tab state freezes CSS animations and `scrollTo({behavior:'smooth'})`.** This bit the mobile-scroll-snap fix this session too — `window.scrollTo({behavior:'smooth'})` silently did nothing in the preview pane until a screenshot forced a repaint; confirmed via `getComputedStyle`/direct DOM reads that the underlying logic was correct, not a real bug. Don't chase this as a regression; force a repaint (screenshot call) before concluding something's actually stuck.
6. **Apps Script's `UrlFetchApp.fetch(..., {muteHttpExceptions: true})` reports "Completed" even on a 404/401/500.** Don't trust "no error in Executions" as proof a webhook actually succeeded — always cross-check `vercel logs` (or equivalent server-side logs) for the real response.
7. **Apps Script's installable trigger function ≠ whatever's in the editor's own Run-button dropdown.** Manually clicking Run tests whatever function that dropdown happens to show, called with zero arguments — a helper function expecting a real event object (`e`) will throw in a way that looks like a real bug but isn't. Only a genuine spreadsheet edit exercises the real trigger path.

## Architecture notes specific to this codebase

- **`TrackProgressProvider`** bridges `HorizontalTrack`'s live scroll position to everything outside that subtree. Extend this, don't invent a second channel.
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
