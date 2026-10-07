import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { contractionMatrix, observerWorldMatrix } from '../src/game/observerFrame';
import { magnitude, relativeVelocity, vec } from '../src/simulation/relativity';

const expectVector = (actual: Vector3, expected: Vector3): void => {
  expect(actual.distanceTo(expected)).toBeLessThan(1e-9);
};

describe('player-relative world deformation', () => {
  it('contracts map distances along motion while preserving the observer and perpendicular lengths', () => {
    const observer = new Vector3(12, 1.7, -9);
    const matrix = observerWorldMatrix(observer, vec(8, 0, 0), 10);
    expectVector(observer.clone().applyMatrix4(matrix), observer);
    expectVector(observer.clone().add(new Vector3(10, 3, 4)).applyMatrix4(matrix), observer.clone().add(new Vector3(6, 3, 4)));
  });

  it('contracts along an arbitrary velocity, including diagonal motion', () => {
    const direction = new Vector3(1, 0, 1).normalize();
    const perpendicular = new Vector3(1, 0, -1).normalize();
    const matrix = contractionMatrix(direction.clone().multiplyScalar(8), 10);
    expectVector(direction.clone().multiplyScalar(10).applyMatrix4(matrix), direction.clone().multiplyScalar(6));
    expectVector(perpendicular.clone().applyMatrix4(matrix), perpendicular);
  });

  it('uses full vector velocity subtraction for transverse motion', () => {
    const relative = relativeVelocity(vec(0, 0, 6), vec(8, 0, 0), 10);
    expect(relative.x).toBeCloseTo(-8, 10);
    expect(relative.z).toBeCloseTo(3.6, 10);
    expect(magnitude(relative)).toBeLessThan(10);
  });

  it('does not double-contract a co-moving object inside the deformed map', () => {
    const observer = vec(8, 0, 0);
    const world = new Group();
    world.matrixAutoUpdate = false;
    world.matrix.copy(observerWorldMatrix(vec(3, 1.7, 2), observer, 10));
    const object = new Group();
    object.matrixAutoUpdate = false;
    object.matrix.copy(contractionMatrix(observer, 10).invert())
      .multiply(contractionMatrix(relativeVelocity(observer, observer, 10), 10)).setPosition(9, 2, 3);
    const clock = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    clock.position.set(2, 0, 0);
    object.add(clock);
    world.add(object);
    world.updateMatrixWorld(true);
    const origin = new Vector3().applyMatrix4(object.matrixWorld);
    const clockPosition = clock.getWorldPosition(new Vector3());
    expect(clockPosition.distanceTo(origin)).toBeCloseTo(2, 10);
  });

  it('opposing motion contracts more strongly and transverse dimensions remain intact', () => {
    const relative = relativeVelocity(vec(-8, 0, 0), vec(8, 0, 0), 10);
    const matrix = contractionMatrix(relative, 10);
    expect(new Vector3(1, 0, 0).applyMatrix4(matrix).length()).toBeCloseTo(0.36 / 1.64, 10);
    expectVector(new Vector3(0, 2, 0).applyMatrix4(matrix), new Vector3(0, 2, 0));
  });

  it('rebuilds from rest coordinates without cumulative deformation or zero-speed discontinuity', () => {
    const point = new Vector3(10, 0, 4);
    for (let frame = 0; frame < 200; frame += 1) {
      const result = point.clone().applyMatrix4(contractionMatrix(vec(8, 0, 0), 10));
      expectVector(result, new Vector3(6, 0, 4));
    }
    expectVector(point.clone().applyMatrix4(contractionMatrix(vec(), 10)), point);
    expectVector(point.clone().applyMatrix4(contractionMatrix(vec(8, 0, 0), 10, 0)), point);
    expectVector(point.clone().applyMatrix4(contractionMatrix(vec(1e-9, 0, -1e-9), 10)), point);
  });
});
