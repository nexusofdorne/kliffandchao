# Immersive plan: realistic meadow, river and transitions

> **What was built instead (28 Oct 2026):** the owner asked to animate the existing scenes in code
> rather than use stock footage. `lib/world-gl/` draws the meadow and the river with WebGL from the
> same depth layers: the plants and grass move in gusts of wind, cloud shadows drift over the
> ground, the river ripples, flows and glitters (a water mask from
> `scripts/design/build_water_mask.py`), the sky creeps, and sheets of mist at three depths sit
> between the layers. The monitor-to-meadow cut is now light (the film flares to white and the
> meadow comes up out of it through mist) instead of static, and the meadow-to-river move flies
> through a bank of mist, with a zoom blur while the camera moves fast. The DOM layers stay as the
> fallback (no WebGL, a lost context) and reduced motion holds the scenery still. The phone design
> uses the same renderer (`prototype-mobile/assets/world-gl.js`). The stock-footage route below
> remains an option if more realism is wanted later.

Written 26 October 2026, after the owner asked for transitions that feel immersive and seamless,
with realistic (not painted, not "AI-looking") water, grass and fog, pointing at these references:
future-human.de, legend.xyz, MotionSites' RIVR, Aethera, Transform Data and SpeakUp heroes, and
gladeye.com.

## 1. What the references actually do

I opened each one in a desktop-sized browser and recorded what it is built from.

| Site | What makes it feel real |
|---|---|
| **future-human.de** | Full-screen **video**: a 2950×3840 top-down shot of real grass in the wind, 33–87 s long, streamed (HLS). A glowing butterfly and the hotspots are drawn on top. "Step into the field / Move forward" moves you from one long clip to the next. |
| **legend.xyz** | Pre-rendered **3D landscape videos** (2560×1200, 6 s seamless loops), with the foreground as a separate video with transparency over the background. That's what gives the depth. |
| **MotionSites heroes** (RIVR, Aethera, Transform Data, SpeakUp) | Each is a cinematic **background video**, streamed, with soft gradient or fog layers and text over it. RIVR's moving water and mist come from the footage itself. |
| **gladeye.com** | A full-screen **WebGL** canvas (real-time 3D/shaders). |

**The common thread:** none of them animate a still painting. The realism comes from **footage**,
filmed or rendered, and the seamlessness from **one continuous camera move**. Each "scene" is a
section of a single long shot, so there is nothing to cut between.

## 2. Why ours can't get there as built

Our meadow and river are two paintings, cut into depth layers and scaled to fake a camera move
(review step 5). That approach has a ceiling:

- **Water and grass can't really move.** Every blade and ripple is a pixel in a still image. The best
  we can do is tilt a layer or slide a highlight, which reads as "animated picture", not as water.
- **The camera move is cardboard.** Scaling flat layers can't show parallax inside a layer, things
  coming around a corner, or the light changing. Up close, the cut-outs and fills look painted.
- **The cuts are hidden, not removed.** Intro → journey cuts behind a burst of static (desktop) or a
  dissolve (phone). Journey → wedding cross-fades one painting's sky into the other's.

Polishing the layers further (WebGL ripples, wind shaders) would help a little, but it would still be
the same paintings.

## 3. Recommended approach: one continuous shot

Build the meadow, the walk to the river and the river from **one continuous camera move in real
footage**, cut into three parts:

```
[ meadow: hold, loops ] -> [ the camera travels forward through the grass to the river ] -> [ river: hold, loops ]
```

- **Each scene is a seamless video loop** cut from the hold at either end of the shot: grass moving
  in the wind, water flowing, mist drifting. Real motion, because it's real footage.
- **Journey → wedding plays the middle part.** Its first frame is the meadow loop's frame and its
  last frame is the river loop's, so there's no cut at all. **Wedding → journey plays it backwards**
  (a separately encoded reversed copy, since browsers can't play video backwards smoothly).
- **Intro → journey:** the camera pushes into the monitor's film. The film's last frame, a bright
  overexposed shot, blooms to white light and opens onto the meadow footage. No static. On the phone
  the film is full-screen, so the same bloom works there too.
- **Fog:** a light WebGL fog layer (drifting noise, a few kB of code, no files) over the footage.
  It thickens as the camera moves, the way RIVR's mist does, and hides any small mismatch at the
  joins. Reduced motion and slow phones get the still frames instead.
- **What stays:** the glass windows, the folders and their cursor, the header, the music, the
  terminal and the intro film. The paintings stay too, as the first frame shown while each video
  loads.

### Where the footage comes from (your decision)

| Option | Realism | Matches the current art | Cost and time |
|---|---|---|---|
| **A. Licensed stock footage (recommended)**, e.g. Pexels (free, no attribution) or Artgrid / Envato (paid, wider choice). One long gimbal or drone shot through a meadow to a river, or a matched pair. | **Real**, as in the references | No: it replaces the painted look, so I'd colour-grade it to the site's soft greens | Low; a day or two to find, cut and encode |
| B. A 3D artist renders the meadow → river move (Blender or Unreal), designed from the paintings | Photo-real if done well, like legend.xyz | Yes | Highest: the artist's fee and their schedule |
| C. AI video (Veo, Kling, Runway) generated from the paintings as start and end frames | Varies, and often has the "AI feel" you want to avoid | Yes | Low cost, but many retries and an uncertain result |

I recommend **A**. It's the only route that is reliably realistic, and it's quick enough to test.
If the stock shots don't fit the story, B is the quality fallback.

### Sizes and phones

- **Desktop:** 1920×1080 loops, about 6–10 s each, H.264 plus a smaller VP9 / AV1 copy, roughly
  2–4 MB per loop. The transition clip is about 4 s.
- **Phone:** a separate portrait crop, 1080×1920 at a lower bitrate, roughly 1–2 MB per loop.
- **Loading:** the next scene's video loads while you're on the current one, and the painting shows
  until the video can play. On a slow connection the site waits, showing the painting, instead of
  stuttering.
- **Total extra download:** roughly 8–12 MB on desktop and 4–6 MB on a phone, spread across the visit.

## 4. Steps

1. **Pick the footage (you and me).** I search Pexels (and Artgrid / Envato if you have an account)
   and shortlist 3–5 candidate shots, with stills and links for you to choose from. I download only
   with your OK. **Check:** you pick one, or a matched pair.
2. **Prototype.** Cut, grade and loop the footage, then build the loops, the forward and reversed
   transition, the light bloom from the intro and the fog. I'd do it in the phone prototype and a
   desktop test page first. **Check:** you try it on your PC and your phone.
3. **Into the site.** Replace the depth-layer world with the video world on desktop and phone (it
   publishes like the phone design does), add the poster frames, the preloading and the reduced-motion
   path, then remove the layer pipeline.
4. **Final check and deploy:** the full run on desktop and phone, tests and build, then deploy on
   your OK.

## 5. Limits

- Realism depends on finding the right shot. A single continuous meadow-to-river move is rarer in
  stock libraries than separate meadow and river clips. If there isn't one, the transition becomes
  two shots joined by a fog-and-light wipe. That's still seamless to the eye, but not one unbroken take.
- Video replaces the painted look of the meadow and river. The glass windows and pixel folders stay,
  so the style becomes "real world, digital interface", like future-human.de.
- Phones on mobile data will download several MB more than today.
