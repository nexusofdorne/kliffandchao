# prototype-v3: the "monitor" redesign (reference only)

A plain HTML/CSS/JS prototype of the redesigned **desktop** guest experience, built from the
mockups and motion spec in `docs/design/v3/`. Like `prototype/`, it's a reference to port
from. It's never built, linted or deployed, and it shouldn't be edited as part of app work
(`CLAUDE.md`).

Screens: 01 gate → zoom into the monitor → 02 terminal → glitch → 03 intro inside the
bezel → 04 journey folder and window → fly-through → 05 wedding folder and window.
`transitions.txt` in `docs/design/v3/` is the spec it follows.

## Run it

```bash
python prototype-v3/serve.py   # http://localhost:4321, no-cache server (see the docstring)
```

Any password works. Dev shortcut: `?scene=2` … `?scene=5` jumps straight to a screen and
exposes `window.proto` (`go12`, `go23`, `go34`, `go43`, `go45`, `go54`) for stepping
through transitions in devtools.

## How it differs from production (see docs/REDESIGN_PLAN.md)

- **Animation:** the Web Animations API here, GSAP in the app.
- **Layers:** `assets/` layers are auto-cut from the flat mockups by
  `scripts/design/prepare_assets.py`, so some seams are visible up close.
- **Baked-in UI:** the 04 and 05 backgrounds and `assets/fly.mp4` still have the nav pill
  baked in, and the journey tabs are flat images with their text baked in. The app renders
  real HTML.
- **Placeholders:** `intro.mp4`, `monitor.mp4` and `music.mp3` are optional slots. Without
  them the page shows a placeholder sky and plays a generated music-box loop.
- **Mobile:** none. Desktop 16:9 only.
