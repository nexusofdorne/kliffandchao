# Design v4: the 3.0 backgrounds (29 October 2026)

Working copies of the couple's 3.0 files (the originals, about 900 MB, stay in the untracked
`3.0/` folder, which `.gitignore` excludes). `scripts/design/prepare_assets.py` and
`build_world.py` read these.

| File | Screen | From `3.0/` |
|---|---|---|
| `01-password-plate.jpg` | 01: the hill and monitor, no text (3288 x 1850, registered 1:1 with v3's plate) | `01 - Password.png` |
| `02-splash-login-1.jpg` | 02: the monitor bezel, empty screen | `02 - splash login 1.png` |
| `03-journey.jpg` | 04 (journey): the path to the white building (3840 x 2160) | `03 - Journey.png` |
| `03-journey-folder-overlay.png` | the "our story" folder and cursor, transparent, 1920 x 1080 | `elements/03 - journey 1.png` |
| `04-wedding.jpg` | 05 (wedding): the hall with the round window (3840 x 2160) | `04 - Wedding.png` |
| `04-wedding-folder-overlay.png` | the "new chapter" folder and cursor, transparent, 1920 x 1080 | `elements/04 - wedding 1.png` |

Made from `3.0/` by their own scripts (re-run them if the 3.0 files change):

- `scripts/design/prepare_journey_media.py`: the chapter films and photos (`public/video/journey/`,
  `public/img/journey/`, `config/journey-media.generated.ts`).
- `scripts/design/prepare_motif.py`: the motif fabrics and outfits (`public/img/motif/`).
- By hand with ffmpeg: `public/video/intro-v2.mp4` (the intro, 1920 wide, 30 fps, no sound),
  `public/img/intro-poster-v2.jpg`, `public/video/gate-screen.mp4` (the couple on the gate's
  monitor), `public/audio/the-blessing-v2.mp3` (128 kbps). The logos (`public/img/brand/`) and Inter
  (`public/fonts/inter/`) were converted once.
