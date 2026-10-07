import { Matrix4, Vector3 } from 'three';
import { contractionFactor, magnitudeSquared, type Vec3 } from '../simulation/relativity';

/** Absolute, observer-centred affine map. Never deform last frame's geometry. */
export function contractionMatrix(velocity: Vec3, lightSpeed: number, amount = 1): Matrix4 {
  const speedSquared = magnitudeSquared(velocity);
  if (speedSquared < 1e-16) return new Matrix4();
  const k = (contractionFactor(Math.sqrt(speedSquared), lightSpeed) - 1) * amount / speedSquared;
  const { x, y, z } = velocity;
  return new Matrix4().set(
    1 + k * x * x, k * x * y, k * x * z, 0,
    k * y * x, 1 + k * y * y, k * y * z, 0,
    k * z * x, k * z * y, 1 + k * z * z, 0,
    0, 0, 0, 1,
  );
}

export function observerWorldMatrix(position: Vec3, velocity: Vec3, lightSpeed: number, amount = 1): Matrix4 {
  const matrix = contractionMatrix(velocity, lightSpeed, amount);
  const origin = new Vector3(position.x, position.y, position.z);
  const contracted = origin.clone().applyMatrix4(matrix);
  return matrix.setPosition(origin.sub(contracted));
}
