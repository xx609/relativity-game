import { describe, expect, it } from 'vitest';
import {
  addRelativisticVelocities,
  closingSpeed,
  dopplerFactor,
  lorentzFactor,
  magnitude,
  properTimeRate,
  relativeVelocityAlong,
  smoothLimitVelocity,
  simultaneousClockTime,
  vec,
} from '../src/simulation/relativity';

describe('relativity math', () => {
  it('returns the classical rest values', () => {
    expect(lorentzFactor(0, 10)).toBe(1);
    expect(properTimeRate(0, 10)).toBe(1);
    expect(dopplerFactor(0, 10)).toBe(1);
  });

  it('slows proper time as speed approaches c', () => {
    expect(properTimeRate(8, 10)).toBeCloseTo(0.6, 8);
    expect(lorentzFactor(8, 10)).toBeCloseTo(5 / 3, 8);
  });

  it('never crosses c when velocities are composed', () => {
    const combined = addRelativisticVelocities(vec(9, 0, 0), vec(9, 0, 0), 10);
    expect(combined.x).toBeCloseTo(9.944751, 5);
    expect(magnitude(combined)).toBeLessThan(10);
  });

  it('is symmetric for an observer moving with the object', () => {
    const relative = relativeVelocityAlong(vec(5, 0, 0), vec(5, 0, 0), vec(1, 0, 0), 10);
    expect(relative).toBeCloseTo(0, 10);
  });

  it('reports positive closing speed for an approaching object', () => {
    const closing = closingSpeed(vec(10, 0, 0), vec(-3, 0, 0), vec(), vec(), 12);
    expect(closing).toBeCloseTo(3);
    expect(dopplerFactor(closing, 12)).toBeGreaterThan(1);
  });

  it('smoothly brings an invalid speed under a lowered limit', () => {
    const before = vec(9, 0, 0);
    const after = smoothLimitVelocity(before, 6, 0.985, 1, 20);
    expect(after.x).toBeLessThan(before.x);
    expect(after.x).toBeCloseTo(5.91, 5);
  });

  it('shows stationary room clocks ticking slower relative to a moving observer clock', () => {
    const before = simultaneousClockTime(0, vec(20, 0, 0), vec(), vec(), vec(8, 0, 0), 10);
    const after = simultaneousClockTime(1, vec(20, 0, 0), vec(), vec(8, 0, 0), vec(8, 0, 0), 10);
    const observerElapsed = properTimeRate(8, 10);
    expect((after - before) / observerElapsed).toBeCloseTo(0.6, 10);
  });

  it('keeps co-moving clocks at the same rate as the observer', () => {
    const before = simultaneousClockTime(0, vec(20, 0, 0), vec(8, 0, 0), vec(), vec(8, 0, 0), 10);
    const after = simultaneousClockTime(0.6, vec(28, 0, 0), vec(8, 0, 0), vec(8, 0, 0), vec(8, 0, 0), 10);
    expect(after - before).toBeCloseTo(0.6, 10);
  });
});
