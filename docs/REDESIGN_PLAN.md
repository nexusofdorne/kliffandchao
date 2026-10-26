# Redesign plan: porting the "monitor" prototype into the production site

Status: **approach decided (section 1), nothing coded yet.** Written 26 October 2026.

I read the whole guest-facing frontend of this repo before writing this: `app/`,
`components/site/`, `components/rsvp/`, `lib/track/`, `lib/gate/`, `lib/audio/`,
`config/`, `content/` and `app/globals.css`. I also read the specs (`CLAUDE.md`,
`HANDOFF.md`, `README.md`, `docs/PLAN.md`, `docs/BUILD_PLAN.md`) and the new reference
material in `Downloads/new website/`:

- the prototype itself: `index.html`, `app.js`, `styles.css`, `assets/` and
  `tools/prepare_assets.py`;
- the mockups `01`–`05` and `transitions.txt`;
- the two videos, `1.mp4` and `kliff&chao website - video.mp4`.

The goal: keep everything that works (gate auth, audio handshake, RSVP, admin, sync, all
wedding content) and replace the **look and the transitions** of the guest-facing desktop
screens with the new prototype.

---

## 1. Decisions (26 October 2026)

| # | Topic | Decision |
|---|---|---|
| 1 | Working copy | **`Downloads/projects/kliffandchao`** (this checkout). The prototype's reference material gets copied in from `Downloads/new website/`. |
| 2 | Pending work | **Done 26 Oct.** The Phase 7 work is ten commits on local `main` (`418e8aa`…`49cd52d`), then merged with `origin/main` (`a3c73c5`), then branched as `redesign/monitor`. Before committing, the local test edits to `chapters.ts`, the `.env*` line in `.gitignore`, `intro2.jpg` and the local boat-photo swap of `intro.jpg` were dropped (all backed up). Nothing is pushed: local `main` is 11 commits ahead of `origin/main`. `origin/kliff` (`fd021e9`, the boat photo as `screensaver.JPG`) was left unmerged. |
| 3 | Navigation model | **Triggered scenes.** One scroll, swipe, key or click plays one fixed-length transition, as in the walkthrough video. Built on GSAP timelines plus GSAP's `Observer`, which ships in the already-installed `gsap` package, so there's no new dependency. This replaces the pinned horizontal track on desktop. |
| 4 | Mobile | **Phones keep today's mobile experience unchanged**, at ≤768px, the existing `STORY_MOBILE_QUERY`. Desktop gets the new design. Mobile gets ported once portrait mockups exist. |
| 5 | Assets | **No designer source files.** Production uses the prototype pipeline's auto-cut layers, plus extra inpainting to remove baked-in UI and text (section 6.3). Some seams will stay visible up close; that's accepted. |
| 6 | Journey content | **The mockup tab titles and paragraphs are final copy. The original photo files are coming.** Until they arrive, photos are cropped from the mockups as stand-ins. |
| 7 | Journey video slots | **Placeholder until videos exist.** A styled empty slot, with an optional `video` field per chapter in `content/` so a file can be dropped in later. |
| 8 | Wedding window | **Icon tabs with small text labels**, in the order DETAIL, TIMELINE, MOTIF, ENTOURAGE, FAQ. Tab content **scrolls inside the window** when it's taller than the window. |
| 9 | Fly-through (04→05) | **Use `1.mp4` as-is. Fade the real top bar out while it plays**, so its baked-in nav doesn't double up, cut into the river (05) during the motion blur, and bring the bar back on arrival. |
| 10 | Preview database | **Done 26 Oct: Preview now points at `kliffandchao-test`.** On Vercel, Preview has its own `DATABASE_URL` (test pooler, `aws-0-ap-southeast-1.pooler.supabase.com:6543`, user `app_test_runner.yplulqnwnlkuzemkebjv`, `sslmode=no-verify`), its own `DIRECT_URL` (test direct host) and `COUPLE_NOTIFY_EMAIL=delivered@resend.dev` (Resend's test inbox). `GOOGLE_SHEET_ID=preview-no-sheet`, so the Sheets mirror and "Sync now" fail safely on previews. Production and Development entries are unchanged; `RESEND_API_KEY` is still shared. Existing preview deployments keep the old values until they're redeployed. |
| 11 | Arrival sequence | **The terminal sequence plays only right after the gate.** Returning guests with a cookie, reloads, and "BACK TO HOME" from RSVP get a short intro entrance instead. |
| 12 | Copy | **"LOGIN SUCCESFUL" → "LOGIN SUCCESSFUL"**, like the earlier MOTTIF → MOTIF fix. The real password check stays (the prototype accepted anything). |
| 13 | Audio button | *Default, not asked:* `AudioToggle` stays visible on every scene, including 04 and 05 where the mockups don't show it, because guests need to be able to mute from anywhere. Say if you want it hidden there. |

---

## 2. Findings: repository state

| Finding | Status and what to do |
|---|---|
| Two checkouts existed (`Downloads/new website/kliffandchao` and this one), identical at commit `3509e7d` with the same 57 uncommitted changes. | **Decided:** work here only. The other copy is left alone; delete it whenever you like. |
| **57 uncommitted changes** on `main`: Phase 7 delivery hardening (`RsvpDelivery`, `SheetMirrorCursor`, admin deliveries), the reduced-motion layout fix, Node 24 enforcement, docs. Several of these files are the ones the redesign rewrites. | **Done:** committed as ten small commits (decision 2). |
| Local `main` was **behind `origin/main`** (Chao's PR #2 and `d365d0a` "changed png to jpg"). | **Done:** merged in `a3c73c5`, with no conflicts. |
| On `origin/main`, the gate background and four journey stories pointed at `/img/intro.jpg` while it was deleted. | **Fixed on GitHub by `d365d0a`**, which put Chao's image back at `intro.jpg`. Nothing left to do. |
| **`public/img/intro.jpg` is now Chao's hill-and-monitor plate: screen 01 with no text and no pill baked in** (1858×1045; `intro.png` is the same image). | Useful for step 1. It's a clean 01 background, so the hardest inpainting (removing "You are invited!" from the grass) may not be needed. It's lower resolution than the 3288-px mockup, so check whether it holds up at 2560 px wide. |
| Migration `20261025000000_rsvp_deliveries` is **not applied** to the real database. Previews *used to* share the production database. | **Resolved for previews (decision 10):** new previews use `kliffandchao-test`, which has all four migrations, so Phase 7 code works there and test RSVPs never reach real guests, the couple's inbox or the real sheet. The migration must still be applied to production before Phase 7 ships to production (`README.md`). |
| Production's `DATABASE_URL` has **no SSL parameter**, so the production app's connection to the Supabase pooler is unencrypted. | Not changed; a separate fix. It needs either `sslmode=no-verify` (encrypted, not verified) or the Supabase CA loaded in `lib/prisma.ts` for full verification. |
| `CLAUDE.md` says **"Don't edit `prototype/`"** and names `prototype/index.html` as the visual source of truth. | Step 0 adds the new prototype as a *separate* reference and updates the spec table in `CLAUDE.md`, `PLAN.md` and `BUILD_PLAN.md` so "visuals" points at it. The location needs your OK (section 9). |
| Production is live with real guests (`kliffandchaov2.vercel.app`, 216 synced guests, RSVPs open). | All work happens on `redesign/monitor` with preview deploys. Nothing reaches `main` or production until you approve it. |

---

## 3. Findings: how the current frontend is built

| Piece | Today | Notes |
|---|---|---|
| Gate | `/` → `GateScreen`: photo with a Ken Burns drift, 40% scrim, SVG grass and pollen (`Ambience`), `Birds`, a glass password pill with an arrow button, then `Loader` (0→100, "PREPARING OUR STORY"), then `router.push('/story')`. | The audio handshake (`playMutedSync()` inside the gesture, then `unmuteAndFadeIn()` after `/api/gate`) and "client-side navigation only" are load-bearing. **Keep both exactly.** |
| Story shell | `/story` (gated by `requireGate()` in `(gated)/layout.tsx`). `story/layout.tsx` wraps `LenisProvider` → `TrackProgressProvider` → `TopBar` + `AudioToggle`. | `TrackProgressProvider` is the bridge between the scroll engine and the chrome: `progress`, `panel`, `activeSection`, `jump()`, `jumpToStory()`. **Keeping this API means `TopBar`, `SectionNav`, `RsvpPill` and `AudioToggle` barely change.** |
| Scroll engine | `HorizontalTrack`: one pinned ScrollTrigger over a 300vw flex track; budget = 1 + (19 − 1) + 1 = 20 screens; snap on the two slide phases; parallax on foreground layers. Mobile and reduced motion stack the sections under native scroll (`lib/track/layout.ts`). | Carries a lot of hard-won workarounds: pin-spacer vs. React `removeChild` (hence `RsvpPill` killing every trigger before navigating), body `display:flex`, rAF suspension, 0×0 viewports. The new desktop scene engine pins nothing. **The stacked mobile mode stays** (decision 4). |
| Intro | `IntroPanel`: full-bleed `intro-web.mp4` (11.8 MB), a gradient, `VerseCycler` bottom-right. | `VerseCycler` (real button, `aria-live`, crossfade guard, hint) is exactly what screen 03 needs. Reuse it as-is. |
| Journey | `JourneyPanel`: drifting background, `Ambience`, `ChapterStepper` (5 dots), `Coverflow` of 19 `StoryCard`s (`lib/track/coverflow.ts`), `ChapterArrows`, paragraph crossfade. Mobile uses a native scroll-snap rail. | Desktop is replaced by the folder → window → 5 chapter tabs design. The mobile rail stays. |
| Wedding | `WeddingPanel`: cream panel with `GlassWash`, `TabBar` (sliding underline), five always-mounted tabs: `DetailTab` (date, `Countdown`, Leaflet `VenueMap`, address, directions), `TimelineTab`, `MotifTab`, `EntourageTab`, `FaqTab`. | The tab *content* survives. On desktop it moves inside the 05 glass window; on mobile it stays as it is. |
| Chrome | `TopBar` (wordmark home button, `SectionNav` glass capsule that tracks scroll, `RsvpPill`), `AudioToggle` (glass disc with equaliser, bottom-left). Light/dark tint switches on the wedding panel. | Already the same composition the prototype uses (logo left, pill nav centre, RSVP right, audio bottom-left). Mostly re-tinting and positioning. |
| RSVP | `/rsvp` full-screen overlay route; `GuestSearch` → `PartyForm` → `Confirmation`; "BACK TO HOME" goes to `/story`. | Logic untouched. Visual alignment with the new glass look is optional polish. |
| Tests | 164 unit tests (Vitest) and 16 DB integration tests, per `HANDOFF.md`. Track maths (`lib/track/*`) is unit-tested. | New pure logic (scene state machine, camera maths, terminal progress curve) gets tests in the same step, per `CLAUDE.md`. |

---

## 4. Mapping: prototype → production (desktop)

| Prototype | Production home | Carries over | New work |
|---|---|---|---|
| **01** Hill + monitor, "You are invited!", ENTER pill | `GateScreen` (route `/`), desktop branch | `/api/gate`, audio handshake, error state, `visualViewport` keyboard fix, password normalisation | Layered scene (sky drift, grass sway, bubbles, glitching monitor screen), ENTER pill (label on hover), heading and subtitle as real HTML over an inpainted plate |
| **01→02** Zoom into the monitor, depth-of-field blur | `GateScreen` → `/story` | Client-side `router.push` (audio survives), `router.prefetch` | The camera move as a GSAP timeline; pure maths (geometric scale, translate, blur ÷ scale) in `lib/`. **Route cut on the black screen** (section 6.2). |
| **02** Terminal: typing, LOGIN SUCCESSFUL, progress 0→100, hello text, dino | New `Terminal` arrival sequence at the top of `/story` (only after the gate, decision 11) | Replaces `Loader` on desktop. The bar holds near 90% until `intro-web.mp4` can play, with a timeout guard (PLAN.md's original intent for the loader). | Typing, progress, dino; copy moves to `content/` |
| **02→03** Grass over the text, green scanline glitch, teal static, sky | Same arrival sequence | n/a | Glitch effects driven by the GSAP ticker, with a `setTimeout` fallback for backgrounded tabs |
| **03** Bezel + grass frame + bubbles, video in the blob, nav, RSVP, mute, verse | `IntroPanel`, desktop branch | `intro-web.mp4` (inside the blob), `VerseCycler`, `TopBar`/`SectionNav`/`RsvpPill`, `AudioToggle` | Layered frame, entrance animations (arrival and direct visit), nav inset to sit inside the bezel |
| **03→04** Nav pill slides to JOURNEY, meadow appears in the blob, border flies out | Scene engine | `SectionNav`'s capsule (it already slides) | "Through the screen" timeline |
| **04** Meadow, "open me" folder, cursor double-clicks, window grows, 5 tabs, red dot closes | `JourneyPanel`, desktop branch | `content/chapters.ts` (restructured), chapter navigation intent | Folder, cursor flourish, glass window, five chapter tab components with real HTML photo collages and text, video placeholder slot |
| **04→05** `1.mp4` fly-through, top bar hidden during it, cut into the river during the motion blur | Scene engine | n/a | Video transition, with the prototype's CSS dolly as the fallback if the clip can't play |
| **05** River, "new chapter" folder, window with 5 icon + label tabs | `WeddingPanel`, desktop branch | **All five tabs' content**: Countdown, VenueMap (lazy init + `invalidateSize`), Timeline, Motif + `Credit`, Entourage, FAQ `<details>` | Window chrome, icon + label tab bar, internal scrolling |
| Back paths (05→04→03), nav jumps, RSVP pill | Scene engine + `TrackProgressProvider.jump()` | Existing API | Reverse timelines |

**Retired from desktop once the new path is verified (deleted only if mobile doesn't
use them):**
- Desktop-only today, safe to delete: the pinned horizontal mode of `HorizontalTrack`,
  `Coverflow`'s transform mode with `lib/track/coverflow.ts` and its tests, `ChapterArrows`,
  `useCoverflowGestures`.
- Still used by mobile, so kept (decision 4): `Ambience`, `Birds`, `Loader`, `StoryCard`,
  `ChapterStepper`, the stacked-section mode and `LenisProvider` (if mobile still uses it).

---

## 5. Risks and hard parts

1. **Two layouts coexist for a while** (decision 4). Desktop runs the scene engine; phones
   run today's stacked track. The split sits at the existing `resolveStoryLayout` decision,
   so each panel component gets a desktop branch rather than being rewritten in place.
   Keep both branches tested, and make the layout switch reload cleanly (it already does).
2. **A route boundary in the middle of a continuous animation.** The gate (`/`) is public;
   `/story` requires the session cookie server-side. Handled by the black-screen cut
   (section 6.2).
3. **Asset quality** (decision 5). The auto-cut layers have small seams: smudges where bubbles
   and UI were inpainted, a few grass slivers on the bezel edge, missed dim daisies. The extra
   inpainting in section 6.3 is the riskiest part, specifically "You are invited!" and the
   pill over the textured hill. Fallback if the inpaint shows: keep the baked text and add a
   visually hidden `<h1>` for screen readers.
4. **Tablets and in-between widths.** Anything wider than 768px gets the 16:9 desktop scene,
   cover-scaled. A portrait tablet (769–1024px wide, taller than wide) crops the sides of
   the bezel and window. That's acceptable for now; revisit with the mobile design.
5. **Journey content model.** Today: 5 chapters × 3–5 stories (19 in total). New: 5 tabs, each
   with a video slot, a bespoke collage of 2–9 photos, and 1–4 paragraphs, with new titles
   ("It started with a wedding"…). `content/chapters.ts` needs a new shape. Mobile still
   reads the old one until it's redesigned, so both shapes are derived from one source (the
   new chapters, with the mobile rail's stories built from them) to avoid duplicating copy.
6. **Wedding content inside a window** (decision 8). Scrolling inside the window solves fit.
   The DETAIL map still needs `invalidateSize` when the window opens, and its width rules
   must follow the window, not the viewport.
7. **Performance.** Screen 03 alone is about 20 layered images plus the 11.8 MB intro video;
   01 adds three full-size swaying copies of its foreground; transitions animate
   `filter: blur()` on large layers. Use `next/image` with `sizes` (AVIF/WebP), preload only
   the next scene, and measure on a mid-range laptop.
8. **Project rules that change how the prototype is ported:**
   - GSAP only: the prototype's Web Animations API code becomes GSAP timelines.
   - Background tabs suspend rAF: every timed sequence needs a `setTimeout` guard.
   - Leftover `filter` values (even `blur(0px)`) switch off `backdrop-filter` inside an
     element; the prototype hit this.
   - Copy lives in `content/`, settings in `config/`, motion and colours in the theme.
   - Strict TypeScript, and unit tests for pure logic.

---

## 6. Approach

### 6.1 Scene engine (desktop)

- **`SceneProvider`** replaces the pinned track on desktop and implements the same
  `TrackProgressProvider` API (`activeSection`, `jump`, and a `progress`/`panel`-like value
  for the nav capsule), so the chrome barely changes.
- **Scene states:** `intro → journey(folder | window: tab 1…5) → wedding(folder | window)`.
- **Input:** GSAP `Observer` turns wheel, touch, keys and nav clicks into
  `next`/`previous`/`jumpTo`.
- **Locking:** transitions are GSAP timelines, and input is locked while one plays. The
  inertia-swallowing gate from the prototype carries over.
- **Pure logic** goes in `lib/scene/` with unit tests: the state transitions, gesture →
  action, "is input allowed", and the camera maths.
- **Lenis isn't used on desktop `/story`.** Scrolling inside the wedding tabs stays native.

### 6.2 Crossing the gate → story boundary: cut on the black screen

1. On a correct password, `GateScreen` calls `router.prefetch('/story')` and plays the 01
   zoom. The monitor screen fades to black with a blinking cursor, and the scene lands on
   the same bezel close-up `/story` opens with.
2. At the end of the zoom, `router.push('/story?arrival=gate')`. If `/story` isn't ready
   yet, the gate simply holds on the black screen.
3. `/story` mounts showing that exact frame and runs the arrival sequence:
   - terminal typing;
   - progress (waiting on the intro video, with a timeout);
   - hello text and the dino;
   - the glitch, with grass rising over the text;
   - teal static;
   - sky and video, then the UI.
4. Without the arrival flag (returning guests, reloads, back from RSVP), `/story` plays a
   short intro entrance (decision 11). The flag is stripped from the URL after it's read,
   so a reload doesn't replay the sequence.

The server-side gate stays exactly as secure as today. The only visual loss: the first
terminal line no longer starts *during* the zoom; a blinking cursor stands in for it.

### 6.3 Stage and assets (decision 5)

- **`<Stage>` component:** a 16:9 box that covers the viewport, with layers positioned in
  percentages from a typed manifest and text sized in container units. That's the
  prototype's approach, made into a component.
- **Pipeline:** `tools/prepare_assets.py` becomes an offline tool (Python, never part of the
  build). Its outputs are committed under `public/img/scenes/<scene>/`. Placing the script
  in the repo needs your OK (section 9).
- **Extra inpainting the prototype didn't need:**
  - 04 and 05 backgrounds: remove the baked-in logo, nav pill and RSVP. They sit over sky,
    so this is easy.
  - 01 foreground: remove "You are invited!", the subtitle and the glass pill, then render
    them as real HTML. This is over grass, so it's the hardest; fallback in section 5.3.
  - The cursor (already done) and the folders stay as separate interactive layers.
  - Chapter photos are cropped from the mockups as stand-ins until the originals arrive
    (decision 6).
- **Video:** `intro-web.mp4` moves into the blob. `1.mp4` becomes something like
  `public/video/to-wedding.mp4`, re-encoded with `+faststart` and no audio, as PLAN.md
  specifies for the intro video. Its baked-in nav is handled by hiding the top bar during
  playback (decision 9).
- **Formats:** WebP/AVIF through `next/image`; measure total weight per scene in step 1.

### 6.4 Reduced motion (desktop)

Scenes change by crossfade: no zoom, glitch, fly-through, sway or drift. Glass, text and
tabs all stay reachable. This mirrors today's reduced-motion path and its tests.

---

## 7. Phased plan

Each step ends on a Vercel **preview** with `lint`, `typecheck` and `test` green, a
side-by-side check against the prototype, and a stop for your review (per `CLAUDE.md`).
Each step is one or a few small commits.

| Step | Scope | Done when | Size |
|---|---|---|---|
| **0. Prepare** ✅ *done 26 Oct* | Commit the pending Phase 7 work (small commits); merge `origin/main` and resolve the `chapters.ts`/intro image overlap; settle the preview-database option (section 2); create `redesign/monitor`; copy the new reference material in (location to agree); update the spec table in `CLAUDE.md`, `PLAN.md` and `BUILD_PLAN.md`; baseline `npm run verify`. | Clean tree, branch created, specs point at the new prototype, baseline green | S |
| **1. Assets** ✅ *done 26 Oct* | Run the pipeline against the mockups with the extra inpainting (section 6.3); crop chapter photo stand-ins; re-encode the fly-through; export to `public/img/scenes/`; write the typed layer manifest. | Every scene's layers exist with no baked UI or text (or the fallback is agreed); weight per scene measured. *Result: 2.5 MB of images in `public/img/scenes/` (gate 0.5, terminal 0.1, intro 0.7, journey 0.5 + stand-in photos, wedding 0.3), plus the 2.4 MB fly-through. Screen 01 is cut from Chao's plate, so no inpainting under the heading or pill was needed; the 04/05 backgrounds had the wordmark, nav, RSVP and folder painted out; the window is exported as six text-free frames.* | M |
| **2. Foundations** | `<Stage>`, shared ambient keyframes (cloud drift, grass sway, bubble bob, CRT jitter) as theme tokens, `lib/scene/` state machine and camera maths with unit tests, `SceneProvider` implementing the `TrackProgressProvider` API, desktop/mobile split at `resolveStoryLayout`, reduced-motion crossfades. | Unit tests cover scene transitions and zoom maths; a scaffold steps through placeholder scenes with the chrome reacting; **mobile unchanged** | M |
| **3. Gate + zoom** | Desktop `GateScreen` as screen 01 (audio handshake and API untouched), ENTER pill, zoom timeline, prefetch, cut to `/story?arrival=gate`. | `PLAN.md` Verification 1, 2, 16 and 20 pass; zoom matches the prototype; mobile gate unchanged | M |
| **4. Arrival + intro** | Terminal arrival sequence (with the spelling fix), then the desktop `IntroPanel` as screen 03 and the direct-visit entrance. | Verification 13–15 and 17 pass; sequence matches the walkthrough; reload doesn't replay it | L |
| **5. Journey** | 03→04 transition; screen 04 (folder, cursor, window, close and reopen); new chapter content model (with the mobile rail derived from it) and tab components with video placeholder slots; tab stepping by scroll. | Every chapter reachable by scroll, click and keyboard; mobile journey still works; README content guide updated | L |
| **6. Wedding** | 04→05 fly-through (top bar hidden during the clip, CSS fallback); screen 05 (folder, window, icon + label tabs, internal scroll); existing tab content inside the window; reverse paths. | Countdown, map, FAQ and the rest all work in the window; back navigation works; mobile wedding unchanged | L |
| **7. Polish + cleanup** | Performance pass, optional RSVP visual alignment, delete the desktop-only retired code and its tests, update `PLAN.md`, `README.md` and `HANDOFF.md`. Then, separately and once portrait mockups exist, the mobile port. | Full `PLAN.md` Verification list on a preview, including the real-iPhone audio check (mobile path) | M |

---

## 8. What stays exactly as it is

`app/api/**`, `app/admin/**`, `lib/**` (except `lib/track` and `lib/gate`, which are
extended), `prisma/**`, `proxy.ts`, `requireGate()`, the session cookie, `AudioProvider`
and its handshake, the `/rsvp` logic and components, `content/verses.ts`,
`content/wedding.ts`, `content/motif.ts`, `content/entourage.ts`, `content/faq.ts`,
`config/site.ts` (gains scene asset paths), the `vercel.json` headers, robots and `noindex`,
and the **whole mobile experience** (until it's redesigned).

---

## 9. Still open (needed during step 0)

1. ~~Preview database~~: done (decision 10). Verify it on the first redesign preview: guest
   search for "Kho" should return the synthetic Kho Family, not real guests.
2. ~~`origin/kliff`'s `fd021e9`~~: decided, left unmerged.
3. ~~Where the new reference material lives~~: decided and done. The prototype is at
   `prototype-v3/` (excluded from tsconfig, ESLint, Prettier and Vitest); the mockups,
   `transitions.txt` and both videos are in `docs/design/v3/` (PNGs converted to JPEG,
   17.4 MB in total); the asset pipeline is at `scripts/design/prepare_assets.py`.
4. ~~The broken `intro.jpg` references on `origin/main`~~: fixed on GitHub by `d365d0a`, now
   merged.
