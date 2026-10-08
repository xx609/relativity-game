import { beforeAll, describe, expect, it } from 'vitest';
import { Group, Raycaster, Vector3 } from 'three';
import { buildTownSquare } from '../src/game/townScenery';
import { CLOCKTOWER } from '../src/simulation/townLayout';

describe('town surface visibility', () => {
  const world = new Group();
  beforeAll(() => {
    buildTownSquare(world);
    world.updateMatrixWorld(true);
  });

  it.each([
    { area: 'paving', x: 0.32, z: 3.42 },
    { area: 'track bed in the square', x: 0.39, z: 6.1 },
    { area: 'track bed in the meadow', x: 26.1, z: 6.3 },
    { area: 'meadow', x: 40.3, z: 12.1 },
  ])('has one visible ground surface under $area', ({ x, z }) => {
    const ray = new Raycaster(new Vector3(x, 2, z), new Vector3(0, -1, 0));
    const hits = ray.intersectObject(world, true);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.point.y).toBeCloseTo(0, 8);
  });

  it.each([0, 1, 2, 3])('has no overlapping clock housing walls on side %s', (side) => {
    const direction = new Vector3(Math.sin(side * Math.PI / 2), 0, Math.cos(side * Math.PI / 2));
    const origin = new Vector3(CLOCKTOWER.x, 12.6, CLOCKTOWER.z).addScaledVector(direction, 10);
    const ray = new Raycaster(origin, direction.negate());
    expect(ray.intersectObject(world.getObjectByName('clocktower')!, true)).toHaveLength(1);
  });
});
