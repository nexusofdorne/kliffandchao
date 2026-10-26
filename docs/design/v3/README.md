# Design v3: the "monitor" redesign

Client mockups and motion references for the redesign of the desktop guest experience,
added 26 October 2026. The HTML prototype built from them is in `prototype-v3/`. The plan
for porting it into the app is in `docs/REDESIGN_PLAN.md`.

The mockups are flat images: UI, text and cursors are baked in. They are references, not
production assets. `scripts/design/prepare_assets.py` cuts them into animatable layers.

| File | Screen | Original filename |
|---|---|---|
| `01-password.jpg` | 01: gate, a hill with a monitor and the "You are invited!" password pill | `01 - password.png` |
| `02-splash-login-1.jpg` | 02: monitor close-up, empty black screen (start of the terminal) | `02 - splash login 1.png` |
| `02-splash-login-2.jpg` | 02: terminal with text, progress bar and greeting (wider crop) | `02 - splash login 2.png` |
| `03-intro-vid.jpg` | 03: intro inside the monitor bezel, grass frame, blue blob for the video, nav, verse, mute | `03 - intro vid.png` |
| `04-journey-00.jpg` | 04: meadow with the "open me" folder and cursor | `04 - journey 00.jpg` |
| `04-journey-0.jpg` | 04: journey window open, empty (frosted glass with five tabs) | `04 - journey 0.jpg` |
| `04-journey-1.jpg` … `04-journey-5.jpg` | 04: chapter tabs 1–5 with photos and copy | `04 - journey 1.jpg` … `5.jpg` |
| `05-new-chapter.jpg` | 05: river with the "new chapter" folder and cursor (wedding) | `05.jpg` |
| `transitions.txt` | Written motion spec for 01→05, the client's own words | `transitions.txt` |
| `transition-04-05-flythrough.mp4` | Rendered fly-through for the journey → wedding transition. Its first frame is the 04 meadow; the nav is baked in. | `1.mp4` |
| `walkthrough-fast-forward.mp4` | Screen recording of the intended site flow and every transition, sped up | `kliff&chao website - video.mp4` |

The four PNG mockups were converted to JPEG (quality 92, no chroma subsampling; PSNR
47–54 dB against the originals, so visually lossless). Their alpha channels were opaque
(minimum 254), so nothing was lost by dropping transparency. The originals are in
`Downloads/new website/`.

**Not in the mockups:**
- a mobile/portrait design (phones keep the current layout for now);
- the content of the 05 wedding window;
- the "dinosaur" mentioned in `transitions.txt`, which the prototype draws as pixel art.
