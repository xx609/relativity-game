import { describe, expect, it } from 'vitest';
import { moveWithCollisions, type Collider } from '../src/simulation/collision';
import { magnitude, subtract, vec } from '../src/simulation/relativity';
import { MAX_BETA, PLAYER_HEIGHT, WorldSimulation, type MovementInput } from '../src/simulation/world';

const idle: MovementInput = { forward: 0, right: 0, sprint: false, yaw: 0, pitch: 0, jump: false, vertical: 0, toggleFlight: false };
const box: Collider = { center: vec(3, 0, 0), halfSize: vec(0.5, 1, 1), velocity: vec() };

describe('continuous contact without position correction', () => {
  it('prevents tunnelling even if a step would cross the entire object', () => {
    const result = moveWithCollisions(vec(), vec(40, 0, 0), 0.2, [box]);
    expect(result.position.x).toBeCloseTo(2.118, 5);
    expect(result.velocity.x).toBe(0);
  });
  it('slides tangentially and stays at contact without alternating across the object', () => {
    let result = moveWithCollisions(vec(), vec(20, 0, 1), 0.2, [box]);
    expect(result.position.z).toBeCloseTo(0.2, 8);
    for (let frame = 0; frame < 20; frame += 1) {
      const before = result.position;
      result = moveWithCollisions(before, vec(1, 0, 1), 1 / 60, [box]);
      expect(result.position.x).toBeCloseTo(2.118, 5);
      expect(magnitude(subtract(result.position, before))).toBeLessThanOrEqual(Math.SQRT2 / 60 + 1e-8);
    }
  });
  it('handles an object moving toward a stationary player with continuous contact motion', () => {
    const result = moveWithCollisions(vec(), vec(), 0.5, [{ ...box, velocity: vec(-8, 0, 0) }]);
    expect(result.position.x).toBeCloseTo(-1.882, 5);
    expect(result.velocity.x).toBe(-8);
  });
  it('lets an initially overlapping player leave without depenetration teleportation', () => {
    const start = vec(2, 0, 0);
    const inside = { ...box, halfSize: vec(1, 1, 1) };
    const result = moveWithCollisions(start, vec(-2, 0, 0), 1 / 60, [inside]);
    expect(result.position.x).toBeCloseTo(2 - 2 / 60, 10);
    const stopped = moveWithCollisions(start, vec(2, 0, 0), 1 / 60, [inside]);
    expect(stopped.position.x).toBe(2);
  });
  it('keeps a tangentially moving player sublight when pushed by a vehicle', () => {
    const movingBox = { ...box, halfSize: vec(0.5, 1, 20), velocity: vec(-8, 0, 0) };
    const result = moveWithCollisions(vec(), vec(0, 0, 9.8), 0.5, [movingBox], 0.38, 10);
    expect(magnitude(result.velocity)).toBeLessThanOrEqual(10 + 1e-9);
    expect(result.velocity.x).toBe(-8);
  });
});

describe('world continuity', () => {
  it('keeps player steps bounded while repeatedly running into vehicles and boundaries', () => {
    const world = new WorldSimulation();
    for (let frame = 0; frame < 1800; frame += 1) {
      const before = { ...world.player.position };
      world.step(1 / 60, { ...idle, forward: 1, right: frame > 700 ? 1 : 0, sprint: true });
      expect(magnitude(subtract(world.player.position, before))).toBeLessThanOrEqual(world.lightSpeed / 60 + 1e-6);
      expect(Math.abs(world.player.position.x)).toBeLessThan(30);
      expect(Math.abs(world.player.position.z)).toBeLessThan(30);
    }
  });
  it('brakes through rail turnarounds without repositioning an entity', () => {
    const world = new WorldSimulation();
    let reversals = 0;
    for (let frame = 0; frame < 3000; frame += 1) {
      const entity = world.entities[0]!;
      const before = { ...entity.position };
      const direction = entity.rail.direction;
      world.step(1 / 60, idle);
      if (direction !== entity.rail.direction) reversals += 1;
      expect(entity.position.x - before.x).toBeCloseTo(entity.velocity.x / 60, 10);
      expect(entity.position.x).toBeGreaterThanOrEqual(entity.rail.minimum);
      expect(entity.position.x).toBeLessThanOrEqual(entity.rail.maximum);
    }
    expect(reversals).toBeGreaterThan(2);
  });
  it('eases a light-speed change and maintains sublight motion on every step', () => {
    const world = new WorldSimulation();
    world.player.position = vec(0, 1.7, 20);
    world.player.velocity = vec(11.5, 0, 0);
    world.setLightSpeed(6);
    expect(world.lightSpeed).toBe(12);
    for (let frame = 0; frame < 180; frame += 1) {
      world.step(1 / 60, idle);
      expect(magnitude(world.player.velocity)).toBeLessThanOrEqual(world.lightSpeed * MAX_BETA + 1e-9);
      for (const entity of world.entities) expect(magnitude(entity.velocity)).toBeLessThanOrEqual(world.lightSpeed * MAX_BETA + 1e-9);
    }
    expect(world.lightSpeed).toBeCloseTo(6, 4);
  });
  it('samples between fixed steps and preserves paused state', () => {
    const world = new WorldSimulation();
    const entity = world.entities[0]!;
    const before = { ...entity.position };
    world.step(1 / 60, idle);
    const middle = world.getVisibleState(entity, vec(), false, 1 / 120);
    expect(middle.position.x).toBeCloseTo((before.x + entity.position.x) / 2, 10);
    world.setPaused(true);
    const position = { ...entity.position };
    world.step(1 / 60, idle);
    expect(entity.position).toEqual(position);
    expect(world.time).toBe(1 / 60);
  });
});

describe('jumping and flight', () => {
  const step = (world: WorldSimulation, frames: number, input = idle): void => {
    for (let frame = 0; frame < frames; frame += 1) world.step(1 / 60, input);
  };

  it('jumps, ignores another jump in the air, lands, and can jump again', () => {
    const world = new WorldSimulation();
    world.step(1 / 60, { ...idle, jump: true });
    expect(world.player.position.y).toBeGreaterThan(PLAYER_HEIGHT);
    expect(world.player.grounded).toBe(false);
    const velocity = world.player.velocity.y;
    world.step(1 / 60, { ...idle, jump: true });
    expect(world.player.velocity.y).toBeLessThan(velocity);
    step(world, 120);
    expect(world.player.position.y).toBeCloseTo(PLAYER_HEIGHT, 8);
    expect(world.player.velocity.y).toBe(0);
    expect(world.player.grounded).toBe(true);
    world.step(1 / 60, { ...idle, jump: true });
    expect(world.player.velocity.y).toBeGreaterThan(0);
  });

  it('flies up, settles into a hover, descends, and returns to walking', () => {
    const world = new WorldSimulation();
    world.step(1 / 60, { ...idle, toggleFlight: true });
    step(world, 45, { ...idle, vertical: 1 });
    expect(world.player.flying).toBe(true);
    expect(world.player.position.y).toBeGreaterThan(PLAYER_HEIGHT + 1);
    step(world, 240);
    expect(magnitude(world.player.velocity)).toBeLessThan(0.00001);
    const hoverHeight = world.player.position.y;
    step(world, 20, { ...idle, vertical: -1 });
    expect(world.player.position.y).toBeLessThan(hoverHeight);
    world.step(1 / 60, { ...idle, toggleFlight: true });
    expect(world.player.flying).toBe(false);
    step(world, 180);
    expect(world.player.position.y).toBeCloseTo(PLAYER_HEIGHT, 8);
    expect(world.player.grounded).toBe(true);
  });

  it.each([-1, 1])('keeps forward/backward movement (%s) level at every look pitch', (forward) => {
    const world = new WorldSimulation();
    step(world, 20, { ...idle, forward, pitch: Math.PI / 3 });
    expect(world.player.position.y).toBeCloseTo(PLAYER_HEIGHT, 8);
    for (const yaw of [0, Math.PI / 3]) {
      let levelSpeed = 0;
      for (const pitch of [0, -Math.PI / 2, -Math.PI / 3, Math.PI / 3, Math.PI / 2]) {
        world.reset();
        world.player.position = vec(0, 10, 16);
        world.step(1 / 60, { ...idle, toggleFlight: true });
        step(world, 30, { ...idle, forward, yaw, pitch });
        expect(world.player.position.y).toBeCloseTo(10, 8);
        expect(world.player.velocity.y).toBe(0);
        expect(world.player.velocity.z * forward).toBeLessThan(0);
        if (pitch === 0) levelSpeed = magnitude(world.player.velocity);
        expect(magnitude(world.player.velocity)).toBeCloseTo(levelSpeed, 8);
      }
    }
  });

  it('lands on the platform, jumps off it, and flies over its footprint', () => {
    const world = new WorldSimulation();
    world.player.position = vec(0, 5, 0);
    world.player.grounded = false;
    step(world, 180);
    expect(world.player.position.y).toBeCloseTo(PLAYER_HEIGHT + 0.655, 8);
    expect(world.player.grounded).toBe(true);
    world.step(1 / 60, { ...idle, jump: true });
    expect(world.player.velocity.y).toBeGreaterThan(0);
    world.player.position = vec(0, 5, 8);
    world.player.velocity = vec();
    world.step(1 / 60, { ...idle, toggleFlight: true });
    step(world, 120, { ...idle, forward: 1 });
    expect(world.player.position.z).toBeLessThan(0);
    expect(world.player.position.y).toBe(5);
  });

  it('keeps combined vertical and horizontal movement sublight as c falls', () => {
    const world = new WorldSimulation();
    world.step(1 / 60, { ...idle, toggleFlight: true });
    for (let frame = 0; frame < 360; frame += 1) {
      if (frame === 120) world.setLightSpeed(1);
      const before = { ...world.player.position };
      world.step(1 / 60, { ...idle, forward: 1, right: 1, vertical: 1, sprint: true });
      expect(magnitude(world.player.velocity)).toBeLessThanOrEqual(world.lightSpeed * MAX_BETA + 1e-8);
      expect(magnitude(subtract(world.player.position, before))).toBeLessThanOrEqual(world.lightSpeed * MAX_BETA / 60 + 1e-8);
    }
  });

  it('preserves flight while paused and clears it on reset', () => {
    const world = new WorldSimulation();
    world.step(1 / 60, { ...idle, toggleFlight: true });
    step(world, 30, { ...idle, vertical: 1 });
    world.setPaused(true);
    const position = { ...world.player.position };
    world.step(1 / 60, { ...idle, toggleFlight: true });
    expect(world.player.position).toEqual(position);
    expect(world.player.flying).toBe(true);
    world.reset();
    expect(world.player.flying).toBe(false);
    expect(world.player.grounded).toBe(true);
    expect(world.player.position.y).toBe(PLAYER_HEIGHT);
  });

  it('sweeps downward and upward contacts without tunnelling', () => {
    const platform: Collider = { center: vec(), halfSize: vec(2, 0.5, 2), velocity: vec() };
    const landing = moveWithCollisions(vec(0, 10, 0), vec(0, -40, 0), 0.5, [platform]);
    expect(landing.position.y).toBeCloseTo(0.88, 8);
    expect(landing.velocity.y).toBe(0);
    expect(landing.grounded).toBe(true);
    const ceiling = moveWithCollisions(vec(0, -10, 0), vec(0, 40, 0), 0.5, [platform]);
    expect(ceiling.position.y).toBeCloseTo(-0.88, 8);
    expect(ceiling.velocity.y).toBe(0);
    expect(ceiling.grounded).toBe(false);
    const above = moveWithCollisions(vec(-5, 2, 0), vec(20, 0, 0), 0.5, [platform]);
    expect(above.position.x).toBe(5);
  });

  it('loses support after moving off the edge of a platform', () => {
    const platform: Collider = { center: vec(), halfSize: vec(2, 0.5, 2), velocity: vec() };
    const result = moveWithCollisions(vec(2, 0.88, 0), vec(10, -1, 0), 0.2, [platform]);
    expect(result.grounded).toBe(false);
  });
});

describe('retarded light-cone state', () => {
  it('converges near c where four fixed-point iterations would oscillate', () => {
    const world = new WorldSimulation();
    const entity = world.entities[0]!;
    entity.velocity.x = 11.64;
    entity.rail.cruiseSpeed = 11.64;
    entity.rail.minimum = -1000;
    entity.rail.maximum = 1000;
    // Use a speed below the rail safety ceiling and enough history for both sides.
    const speed = 12 * MAX_BETA * 0.98;
    entity.velocity.x = speed;
    entity.rail.cruiseSpeed = speed;
    for (let frame = 0; frame < 120; frame += 1) world.step(1 / 60, idle);
    for (const offset of [-0.1, -0.01, 0, 0.01, 0.1]) {
      const observer = { ...entity.position, x: entity.position.x + offset };
      const state = world.getVisibleState(entity, observer, true);
      const delay = offset > 0 ? offset / (12 - speed) : -offset / (12 + speed);
      expect(state.position.x).toBeCloseTo(entity.position.x - speed * delay, 6);
      expect(state.properTime).toBeCloseTo(entity.properTime - delay * Math.sqrt(1 - speed ** 2 / 144), 6);
    }
  });
  it('stays finite when the observer overlaps an object at startup', () => {
    const world = new WorldSimulation();
    const entity = world.entities[0]!;
    expect(world.getVisibleState(entity, entity.position, true).position).toEqual(entity.position);
  });
});
