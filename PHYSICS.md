# Simulation and observer view

The simulation runs at 60 Hz in the room's reference frame. Rendering interpolates the previous and current states and applies one continuous observer transform. Geometry always starts from its original coordinates; deformation never accumulates on already-deformed geometry.

## Units and motion

- Distance uses arbitrary world units (`u`), time uses seconds, and `c` defaults to `12 u/s`.
- The light-speed slider requests `6-40 u/s`. The simulation eases to that setting. Reducing `c` scales velocities continuously with it so no massive body temporarily exceeds the limit.
- Player acceleration uses vector Einstein velocity addition. Speeds are bounded by `MAX_BETA = 0.985`.
- Walking adds a gameplay gravity acceleration and a grounded jump impulse. Flight disables gravity, keeps forward and sideways thrust horizontal regardless of view pitch, and adds vertical thrust only from Space (up) and Shift (down). All three velocity components share the same speed limit; gravity is a movement mechanic, not a general-relativity model.
- Rail vehicles brake before their endpoints and reverse through zero velocity. Their positions are integrated, never snapped back to an endpoint.

## The map and all objects

For observer velocity `v`, unit direction `n`, and `gamma = 1/sqrt(1-v²/c²)`, the spatial contraction is

`C(v) = I + (1/gamma - 1) n nᵀ`.

Every stationary point `x` is rendered at `player + C(v)(x - player)`. The observer remains fixed; distances parallel to motion contract and perpendicular distances stay unchanged. This affects the floor, floor grid, walls, rails, platform, reference clocks, scenery, lights, shadows, and optional grid. Looking around does not change the contraction direction; changing velocity does.

Moving objects use full vector Einstein velocity subtraction `u' = (-v) ⊕ u`, including transverse motion. Their local matrix is `C(v)⁻¹ C(u')`, so the shared world matrix gives them exactly one relative contraction. A co-moving object has its proper dimensions; opposing motion gives a stronger contraction. All attached pieces, clocks, bands, and arrows inherit the same matrix. Normals and raycasting use these matrices too. Frustum culling is disabled for these small room meshes because Three.js's usual bounding-sphere scaling can underestimate a sheared shape.

The contraction formula and its directional interpretation follow [Einstein Online's length-contraction explanation](https://www.einstein-online.info/en/explandict/length-contraction/).

## Clocks and light delay

The simulation records each vehicle's proper time, position, and velocity. Without light delay, clock faces use an instantaneous inertial simultaneity correction:

`delta_t = v · (object_position - player_position) / (c² - v · u)`.

The displayed clock time is its current proper time plus `delta_t/gamma(u)`. Stationary reference clocks use the same convention with `u = 0`. This shows slower room clocks relative to a moving observer's proper time and matching rates for co-moving clocks. Accelerating bodies use their current velocity as a local approximation.

Optional light delay solves `t_emit + distance(position(t_emit), observer)/c = t_observe` by 32 bracketed bisection steps. It replaces the old four-step fixed-point iteration, which converged poorly near light speed. Position, velocity, and clock phase come from the same interpolated emission state. Stationary clocks include their propagation delay too. At startup, events before recorded history use the earliest sample. History covers at least 16 seconds and expands for lower light speeds.

## Color and transitions

All mesh and line materials use a per-fragment Doppler visualization. With sightline `n` from observer to source in room coordinates:

`D = gamma(v) (1 + v·n/c) / [gamma(u) (1 + u·n/c)]`.

This includes transverse Doppler behavior and shifts different parts of large surfaces independently. Display color blends toward blue or red using `log2(D)`; emission spectra and physical radiance are not simulated.

Observer velocity and effect weights ease with frame-rate-independent exponential responses. Classical comparison, contraction, Doppler, and light delay blend in and out. The field of view stays at the selected value, with no artificial speed zoom or head bob competing with the spatial transform. Low distortion softens color shifts and slows observer-frame transitions without changing the settled contraction. Reduced motion freezes the optional grid's decorative animation.

## Contacts and close passes

Swept three-dimensional player-body collisions handle the floor, room walls, scenery, and moving vehicles in the simulation frame. The solver advances to first contact and slides or moves with the obstacle. It never teleports the player out of penetration; initial overlap allows motion outward. Support at the final position enables jumping from the floor or an object. Players can fly over obstacles and the open room walls. Vehicle collision boxes use world-frame contracted dimensions, and static scenery uses conservative box footprints with heights matching the scenery. The same collision state remains active in classical and relativistic views.

Rendering uses a smaller near plane and updates scene/camera matrices before picking. Together with interpolated positions and stable delayed states, these avoid clipping, stale targeting, and abrupt jumps at close range.

## Scope

This is an educational instantaneous-frame visualization, not a complete relativistic optical renderer. Moving object centers stay attached to their contracted room snapshot (or their delayed center), while local dimensions and clock simultaneity use the observer frame. Exact global simultaneity of accelerated extended bodies, Wigner/Terrell rotation, per-vertex emission events, relativistic collision dynamics, aberration, gravitational curvature, and spectral radiance are not implemented. The optional spacetime overlay is a visual instrument, not a Minkowski diagram.

## Verification

`pnpm test` checks arbitrary-direction contraction, observer invariance, co-moving and opposing objects, clock rates, continuous collisions, sublight motion, rail reversals, interpolation, pause, and close-range light-cone convergence. `pnpm build` type-checks and builds production assets.

With the dev server running, `/tests/visual.html` provides deterministic rest, forward, diagonal, co-moving, classical, grid, delay, and contact scenarios. It reports the map determinant and courier scale for browser verification without adding debug controls to the game.
