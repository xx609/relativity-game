# Relativity Game

A small first-person WebGL experiment that makes special relativity visible by allowing the player to lower the simulated speed of light.

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

The generated `dist/` folder is a static site and can be served from GitHub Pages, Netlify, Cloudflare Pages, or any ordinary static host.

## Controls

- `WASD` or arrow keys — move
- Mouse — look
- `Shift` — accelerate faster
- `P` — pause
- `R` — reset
- `C` — classical/relativistic visual comparison
- `Esc` — release pointer or close settings

The speed-of-light control is at the bottom of the HUD. Double-clicking its slider restores the default `c = 12` demonstration setting.

## Architecture

- `src/simulation/` — renderer-independent fixed-step world and relativity math
- `src/game/` — Three.js scene, input, and visual effects
- `src/features/` — lazy-loaded optional scenery and spacetime overlay
- `tests/` — numerical behavior tests

See [PHYSICS.md](./PHYSICS.md) for the reference-frame conventions and intentional approximations.
