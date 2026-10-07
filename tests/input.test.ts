import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputController } from '../src/game/InputController';
import { WorldSimulation } from '../src/simulation/world';

describe('Space flight gesture', () => {
  let input: InputController;
  let events: EventTarget;

  const key = (type: 'keydown' | 'keyup', timeStamp: number, code = 'Space', repeat = false): void => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      code: { value: code },
      repeat: { value: repeat },
      timeStamp: { value: timeStamp },
    });
    events.dispatchEvent(event);
  };

  beforeEach(() => {
    events = new EventTarget();
    vi.stubGlobal('window', events);
    vi.stubGlobal('document', new EventTarget());
    vi.stubGlobal('Element', class extends EventTarget {});
    input = new InputController(new EventTarget() as HTMLElement);
  });

  afterEach(() => {
    input.destroy();
    vi.unstubAllGlobals();
  });

  it('jumps immediately on a single tap and toggles flight on a second tap', () => {
    const world = new WorldSimulation();
    key('keydown', 0);
    world.step(1 / 60, input.movement());
    expect(world.player.velocity.y).toBeGreaterThan(0);
    expect(world.player.flying).toBe(false);
    key('keyup', 80);
    key('keydown', 200);
    world.step(1 / 60, input.movement());
    expect(world.player.flying).toBe(true);
    expect(input.movement().toggleFlight).toBe(false);
    // A second distinct pair switches flight off, even when all taps are quick.
    key('keyup', 220);
    key('keydown', 240);
    world.step(1 / 60, input.movement());
    expect(world.player.flying).toBe(true);
    key('keyup', 260);
    key('keydown', 280);
    world.step(1 / 60, input.movement());
    expect(world.player.flying).toBe(false);
  });

  it('keeps slow taps as separate jumps', () => {
    key('keydown', 0);
    input.movement();
    key('keyup', 50);
    key('keydown', 400);
    expect(input.movement()).toMatchObject({ jump: true, toggleFlight: false });
  });

  it('does not count held or repeated keydowns as another tap', () => {
    key('keydown', 0);
    input.movement();
    key('keydown', 100);
    key('keydown', 200, 'Space', true);
    expect(input.movement()).toMatchObject({ jump: false, toggleFlight: false, vertical: 1 });
    key('keyup', 210);
    expect(input.movement().vertical).toBe(0);
  });

  it('preserves a quick double tap between physics steps and lets the second press rise', () => {
    key('keydown', 0);
    key('keyup', 5);
    key('keydown', 10);
    expect(input.movement()).toMatchObject({ jump: false, toggleFlight: true, vertical: 1 });
    expect(input.movement()).toMatchObject({ jump: false, toggleFlight: false, vertical: 1 });
  });

  it.each(['blur', 'reset', 'deactivate'] as const)('clears pending taps on %s', (action) => {
    key('keydown', 0);
    key('keyup', 20);
    if (action === 'blur') events.dispatchEvent(new Event('blur'));
    if (action === 'reset') input.reset();
    if (action === 'deactivate') {
      input.setActive(false);
      key('keydown', 50);
      expect(input.movement().jump).toBe(false);
      input.setActive(true);
    }
    key('keydown', 100);
    expect(input.movement()).toMatchObject({ jump: true, toggleFlight: false });
  });

  it('keeps F as an alternate toggle without pairing taps across it', () => {
    key('keydown', 0);
    key('keyup', 20);
    key('keydown', 50, 'KeyF');
    expect(input.movement().toggleFlight).toBe(true);
    key('keydown', 100);
    expect(input.movement()).toMatchObject({ jump: true, toggleFlight: false });
  });
});
