# Relativity Game

A small first-person WebGL experiment set in Clocktower Square, a sunlit village with a working clocktower, two ground-level tram lines, cottages, and open gardens. Lower the simulated speed of light to make special relativity visible.

## Run locally

Install Node.js and pnpm. From the project folder, install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Open the local URL printed in the terminal. The development server updates the app as you edit the source. Press `Ctrl+C` to stop it.

## Build and tests

```bash
pnpm test
pnpm build
```

To preview the production build locally:

```bash
pnpm preview
```

## Hosting

The generated `dist/` folder is a static site and can be served ordinary static host.

Or simply uses localhost:
```
python -m http.server 8000 --directory dist
```

## Controls

- `WASD` or arrow keys — move
- Mouse — look
- Scroll wheel — adjust the simulated speed of light (`c`)
- `Shift` — accelerate faster while walking; hold to descend while flying
- `Space` — jump; hold to rise while flying
- Double-tap `Space` — toggle flight (turn off to fall and land); `F` also works
- `P` — pause
- `R` — reset
- `C` — classical/relativistic visual comparison
- `Esc` — release pointer or close settings
- Touch — use the left joystick to move, drag the scene to look, and tap the right jump button (hold to rise while flying)

The speed-of-light control is at the bottom of the HUD. Scroll up to raise `c` and down to lower it while exploring or hovering the control. Double-clicking its slider restores the default `c = 12` demonstration setting.

While flying, `WASD` moves horizontally in the direction you face, regardless of how far up or down you look. Only `Space` and `Shift` control vertical thrust. Releasing movement keys coasts with light drag; press the opposite direction to stop faster. The speed gauge shows your speed, fraction of light speed, and Lorentz factor; jumping and flying share the same light-speed limit and solid-object collisions as walking.

The square and meadow are open to explore. Tracks and planting are passable; the clocktower, cottages, and two trams are solid. The old central platform, perimeter walls, and scattered blocking props have been removed.

## Architecture

- `src/simulation/` — renderer-independent fixed-step world and relativity math
- `src/game/` — Three.js scene, input, and visual effects
- `src/simulation/townLayout.ts` — shared town footprints and rail positions
- `src/features/` — lazy-loaded optional scenery and spacetime overlay
- `tests/` — numerical behavior tests

See [PHYSICS.md](./PHYSICS.md) for the reference-frame conventions and intentional approximations.
