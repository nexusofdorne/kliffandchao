# Review plan: the 26 October 2026 feedback

Status: **step 1 built, not committed or deployed; steps 2-8 waiting.** Written 26 October 2026.
The owner approved the plan with the recommended answers to the five decisions in section 2.

Step 1 (26 Oct): the password text has a stronger shadow plus a faint shade behind it
(`.gate-scrim`); the terminal's progress bar has no box and the block is moved up 8.4cqh so it
is centred; on desktop the song starts silently in the Enter tap as before but is only brought in
(restarted, faded up) by `DesktopStory` through `beginMusic()` when the intro appears, and phones
keep their old behaviour until the phone port; the music button starts the music on a tap when
autoplay was refused; the fourth journey tab reads MEET FAMILY / & FRIENDS (`tabLabel` in
`content/chapters.ts`). Typecheck, lint and the 200 tests pass.

The feedback is saved verbatim in `docs/review/2026-10-26-feedback.md`, with its three
images next to it:

- `2026-10-26-phone-live-intro.jpg`: the live site's current phone intro (the old phone
  design). The film fills the screen, the logo, section pill and RSVP sit in one row at the
  top, and the music button is bottom-left. When the feedback says "the existing mobile
  layout" and the header's "original styling", it means this.
- `2026-10-26-journey-window.jpg`: pixel-for-pixel the designer's mockup
  `04 - journey 0.jpg`. It's the look for the journey window, to be rebuilt in CSS rather
  than cut from the picture (today the window is the picture: `frame0`–`frame5`).
- `2026-10-26-wedding-window.webp`: new. The wedding window in the same material, with five
  text tabs with green dots (DETAILS, TIMELINE, MOTIFF, ENTOURAGE, FAQ). DETAILS has the
  date, countdown, venue and address on the left and the map on the right.

---

## 1. How I read the feedback

1. **Desktop changes go into the site.** Phones don't have the new design in the site yet
   (they still get the old stacked layout), so the **phone changes go into
   `prototype-mobile/` first**. Once you've checked them on your phone, the phone port puts
   them in the site (decision 2).
2. **The intro becomes the login monitor playing the film.** The grass ring, flowers,
   bubbles and the 03 bezel go. The film fills the whole inner screen of the
   `02 - splash login 1.png` monitor. Login → intro then happens inside one monitor: the
   glitch wipes the text and the film comes on in the same screen.
3. **The camera moves need the scenery in depth layers.** Today each scene is one flat
   painting, and journey → wedding plays the designer's fly-through clip with a blur-fade
   at each end. "Independent foreground, midground and background parallax" means cutting
   the meadow (04) and the river (05) into separate layers at different depths. A camera
   moving forward then passes the near layers fast and the far ones slowly. This is 2.5D:
   painted layers in depth, not a 3D model (decision 1).
4. **No fades between scenes.** Every hand-off happens behind something that crosses the
   whole frame: the monitor bezel passing the camera, the CRT glitch on the screen, or
   foreground plants passing in front of the lens. Crossfades stay only for guests who turn
   on reduced motion.
5. **The nav never hides.** On desktop the top bar is hidden during journey → wedding only
   because the fly-through clip has a top bar baked into it. With the clip gone, the real
   bar stays on. On phones, the header is a fixed layer at the top from the intro onward
   (decision 4).
6. **The music starts at the intro.** Browsers only allow sound that starts inside a tap or
   click, so the Enter tap still starts the song, but muted. It stays silent through the
   dive and the terminal, then fades in from the start of the song as the intro appears.
   When there was no tap (a returning guest who goes straight to the story), the button
   shows the music as off, and one tap starts it.

## 2. Decisions for you

| # | Question | My recommendation | Alternative |
|---|---|---|---|
| 1 | Where the scenery layers come from | **I cut them from the existing 04 and 05 paintings.** I extend them where the camera needs more, fill what sits behind each cut-out from the surrounding texture, and reuse the intro's grass and flower cut-outs as plants passing the lens. Up close, some edges will look painted. If the designer can supply layered files later (sky, hills, middle, foreground as separate transparent PNGs, ideally at twice the size), they go through the same pipeline and replace mine. | Wait for layered files, or a start-to-end clip, from the designer before building the camera moves. |
| 2 | Where the phone changes go first | **`prototype-mobile/`.** It's quick to change, and you can open it on your phone over Wi-Fi. The port into the site comes after you sign it off (step 7). | Straight into the site. It takes longer before you see anything on the phone. |
| 3 | The wedding window | **Match the new image.** Text tabs with green dots replace the icon tabs, and DETAILS has the date and venue left, map right. I'd spell the tab "MOTIF" (the image says MOTIFF) and use "DETAILS" (the site says DETAIL). | Keep the icon tabs and change only the material. |
| 4 | Phone header on the password and login screens | **From the intro on.** Before the password is accepted, the links can't go anywhere. | Show it on the gate too, with the links disabled. |
| 5 | Deploys | **Two deploys:** after steps 1–3 (the quick fixes, the glass, the new intro), then after steps 5–6 (the camera moves). Each one waits for your OK. | One deploy at the end. |

## 3. The work, in order

I stop at the end of each step so you can look, unless you approve a range of steps in
one go (as with the redesign).

### Step 1 — Quick desktop fixes (small)

| Review point | What changes | Where |
|---|---|---|
| Desktop 1, password readability | A soft dark text shadow, plus a very faint shade behind the text block, on "You are invited!" and the subtitle. Same font, size and position. | `components/site/gate/DesktopGate.tsx`, the gate styles in `app/globals.css` |
| Desktop 2, login | Drop the dark box behind the progress bar (only the outlined bar, percentage and hourglass stay). Centre the whole terminal block vertically in the screen (today the boot lines start 28% down and the block sits low). The typing, timing and text stay the same. | the `.crt-*` styles in `app/globals.css` |
| Desktop 3 + Mobile 2, music at the intro | As in section 1, point 6. The stored mute choice is still respected. | `GateScreen.tsx`, `AudioProvider.tsx`, `DesktopStory.tsx` (and the prototype's `app.js` in step 4) |
| Desktop 5, "& friends" | A fixed line break: MEET FAMILY / & FRIENDS, with room from the tab edges. | `content/chapters.ts` (an optional two-line label), `JourneyScene.tsx` |

Check: in the browser at 1920 × 1080 and 1366 × 768: the full gate → terminal → intro run,
music timing, music with the stored mute on, and a direct visit.

### Step 2 — Liquid glass rebuilt in CSS (medium)

Review points: Desktop 5, A. One material, defined once and used by the journey window, the
wedding window, and later the phone card and sheet:

- **Surface:** milky and mostly opaque, a warm white at roughly 75–85% over a backdrop blur,
  so the meadow shows through only as soft colour.
- **Edges:** a thin bright rim along the top and left edges, a softer shade along the bottom
  and right, and a gentle outer shadow.
- **Depth:** the content plate is set in, as in the mockup, with a soft inner shadow (the
  neumorphic part).
- **Tabs:** real rounded folder tabs (the active one raised and lighter), traffic-light
  dots, and dark text at 7:1 contrast or better.

The wedding window is laid out to match the new image (decision 3). The other tabs keep
their current content.

This replaces `frame0`–`frame5` and their pipeline step. Check: screenshots side by side
with the mockup, contrast measured, and every tab, close button and scroll area still
working.

### Step 3 — The intro inside the login monitor (medium)

Review point: Desktop 3.

- **Removed:** the grass ring, flowers, bubbles and 03 bezel.
- **The film:** it fills the 02 monitor's inner screen, cut to its rounded CRT shape and
  scaled to cover. The film and the screen are both close to 16:9, so almost nothing is
  cropped. A faint glass sheen and vignette on top keep it reading as a screen.
- **Login → intro:** the existing glitch wipes the text, and the film powers on in the same
  screen.
- **A direct visit:** the monitor appears and the film powers on.
- **Unchanged:** the verse, nav, wordmark, RSVP and music button stay where they are.

The `s03_*` layers leave the site. The grass and flower cut-outs are kept for step 5.

### Step 4 — Phone prototype layout (medium)

All in `prototype-mobile/`:

- **Mobile 4, header:** the logo, the INTRO / JOURNEY / WEDDING pill and RSVP in one row at
  the top, as in the live-site screenshot. It's a fixed layer inside the top safe area (the
  notch), above every scene and transition, and it's never hidden, shrunk or moved. Scene
  content is laid out below it.
- **Mobile 5, music:** one button, fixed bottom-left above the home-indicator area, that
  clearly shows playing or muted (the bars icon from the live site). It appears at the
  intro and stays. The current mute in the header goes.
- **Mobile 1, password:** screen 01 is recomposed so the monitor sits at the vertical centre.
- **Mobile 1, login:** no monitor. A full-screen black terminal, centred both ways, with
  type sized for a phone. Same text, caret, progress bar and sequence.
- **Mobile 2, intro:** the film fills the screen, as on the live phone intro today. No grass
  or bubbles, the verse near the bottom, and the music fades in here.
- **Journey card and wedding sheet:** they get the step 2 glass.

Check: on your phone over Wi-Fi (`python prototype-mobile/serve.py`). Watch for the music
starting at the intro on iPhone Safari, the films playing, the swipes, and the notch.

### Step 5 — One world: depth layers and the two camera moves (large, the main job)

Review points: Desktop 4, Desktop 6, B, C.

**5a. Layer pipeline** (`scripts/design/build_world.py`, new)
- **Cutting:** the meadow (04) and the river (05) are each cut into about 5–7 depth layers:
  sky, far hills, middle distance, near ground and foreground plants, plus the water for 05.
- **Filling and extending:** what sits behind each cut is filled so the layer can move, and
  the paintings are extended where the camera sees past their edges.
- **Loose plants:** grass tufts, daisies and the 05 branches, for the camera to pass through.
- **Grading:** both scenes share one grade, so they read as one place.
- **Output:** landscape and portrait sets as WebP, plus a generated config with each layer's
  depth.
- **Tools:** numpy, scipy and scikit-image are installed. I may add `opencv-python` for
  better gap filling; it's a design tool only, never a site dependency.

**5b. Camera** (`lib/scene/camera.ts`)
- Each layer has a depth. Moving the camera forward scales and shifts every layer by
  perspective, so near layers rush past and far ones barely move. The maths gets unit tests
  like the existing camera code.
- Only transforms are animated, which the GPU handles well. Motion blur is applied to the
  nearest plants only.

**5c. Intro → journey**
1. The camera pushes into the monitor, and the bezel grows past the edges of the frame.
2. As the screen fills the view, a short CRT glitch switches it from the film to the meadow.
3. The camera travels on, low through the meadow: grass and daisies pass the lens, the
   middle distance drifts, the sky barely moves.
4. It settles on the journey meadow with the folder.

Journey → intro is the same move in reverse.

**5d. Journey → wedding**
1. The window closes into the folder.
2. The camera travels on through the meadow, and the land opens up.
3. The riverside plants of 05 come in from the edges as near layers. The meadow ground
   slides under the camera and reveals the water.
4. The far hills give way to the river valley's. That swap happens behind a band of
   foreground plants crossing the lens, so there's no cut and no fade.
5. It settles on 05 with the "new chapter" folder.

The way back is the reverse. This retires `to-wedding.mp4` (2.4 MB) and the haze fallback.

**5e.** The nav stays visible through every move, on desktop too.

Check:
- **Smoothness:** frame pacing during each move (aiming at 60 fps on an ordinary laptop).
- **Weight:** asset size kept close to today's (the clip goes, the layers replace it), each
  scene's layers preloaded while the previous scene is on screen.
- **Reduced motion:** short crossfades.
- **Stability:** no layout shift.

**Risk:** the big unknown is how far the camera can travel before the painted layers look
flat or soft. I'll show you a first cut of 5c before building 5d, so you can judge the look
early. The prototype gets the portrait version of 5c and 5d in this step too.

### Step 6 — A living wedding scene (small to medium)

Review points: Desktop 7, Mobile 3.

- **The plants:** foliage sways from its base, slowly and out of step (6–10 second loops).
- **The river:** gentle ripples and glints, a slow moving distortion on the water layer only.
- **Calm:** it pauses when the scene is off screen, stops for reduced motion, and the phone
  gets a lighter version.
- **Optional, small:** the same gentle sway on the journey meadow's grass, so the whole world
  feels alive.

### Step 7 — The phone port into the site (large; after you sign off the prototype)

This is the port already listed in `HANDOFF.md`:

- a portrait stage mode and the scenes' portrait layouts;
- phone assets, including a lighter encode of the intro film;
- `StackedStory` and the old phone panels retired;
- tests on real phones.

Until this step ships, the live phone site stays on the old design.

### Step 8 — Final check (Review point D)

The full run, Password → Login → Intro → Journey → Wedding and back:

- **Where:** desktop at 1920 × 1080, at 1366 × 768 and on a laptop at 125% zoom; phones on
  iPhone Safari, Android Chrome and Messenger's in-app browser.
- **What:** the transitions; glass readability; every tab, folder, button and media control;
  the fixed phone header and music button; reduced motion; blocked autoplay; no flicker,
  clipping or layout shift.
- **Then:** tests, typecheck, lint and build. Deploy on your OK.

## 4. Limits

- **No new generated scenery.** Every layer comes from the existing paintings, cut, extended
  and regraded.
- **It's 2.5D.** A true 3D fly-through would need new 3D or video art from the designer.
- **Not touched:** password checking, sessions, RSVP, admin, sync and all wedding content
  keep working as they do.
