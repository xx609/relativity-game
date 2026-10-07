import { add, clampMagnitude, dot, scale, subtract, vec, type Vec3 } from './relativity';

export interface Collider {
  center: Vec3;
  halfSize: Vec3;
  velocity: Vec3;
}

const SKIN = 0.002;
const AXES = ['x', 'z'] as const;

/** Sweep a player footprint against moving boxes; slide at contact, never teleport out. */
export function moveWithCollisions(
  start: Vec3, velocity: Vec3, deltaSeconds: number, colliders: Collider[], radius = 0.38, maximumSpeed = Infinity,
): { position: Vec3; velocity: Vec3 } {
  let position = { ...start };
  let resolvedVelocity = { ...velocity };
  let elapsed = 0;
  let remaining = deltaSeconds;

  for (let iteration = 0; iteration < 5 && remaining > 1e-8; iteration += 1) {
    let firstTime = remaining;
    let contact: { normal: Vec3; velocity: Vec3 } | null = null;
    for (const collider of colliders) {
      const offset = subtract(position, add(collider.center, scale(collider.velocity, elapsed)));
      const relative = subtract(resolvedVelocity, collider.velocity);
      const half = { x: collider.halfSize.x + radius + SKIN, z: collider.halfSize.z + radius + SKIN };
      let entry = -Infinity;
      let exit = Infinity;
      let normal = vec();
      let inside = true;
      let nearest = Infinity;
      let insideNormal = vec();
      for (const axis of AXES) {
        const penetration = half[axis] - Math.abs(offset[axis]);
        if (penetration < 0) inside = false;
        if (penetration < nearest) {
          nearest = penetration;
          insideNormal = vec();
          insideNormal[axis] = Math.sign(offset[axis]) || 1;
        }
        if (Math.abs(relative[axis]) < 1e-10) {
          if (Math.abs(offset[axis]) > half[axis]) exit = -Infinity;
          continue;
        }
        const a = (-half[axis] - offset[axis]) / relative[axis];
        const b = (half[axis] - offset[axis]) / relative[axis];
        const near = Math.min(a, b);
        if (near > entry) {
          entry = near;
          normal = vec();
          normal[axis] = -Math.sign(relative[axis]);
        }
        exit = Math.min(exit, Math.max(a, b));
      }
      if (inside) {
        // An expanding shape or a reset can overlap the footprint. Allow escape;
        // don't project the player to a different position to resolve penetration.
        if (dot(relative, insideNormal) < -1e-8) {
          firstTime = 0;
          contact = { normal: insideNormal, velocity: collider.velocity };
        }
      } else if (entry >= 0 && entry <= firstTime && entry <= exit && exit >= 0) {
        firstTime = entry;
        contact = { normal, velocity: collider.velocity };
      }
    }
    position = add(position, scale(resolvedVelocity, firstTime));
    elapsed += firstTime;
    remaining -= firstTime;
    if (!contact) break;
    const inward = dot(subtract(resolvedVelocity, contact.velocity), contact.normal);
    if (inward < 0) {
      resolvedVelocity = subtract(resolvedVelocity, scale(contact.normal, inward));
      const normalSpeed = dot(resolvedVelocity, contact.normal);
      const normalVelocity = scale(contact.normal, normalSpeed);
      const tangent = subtract(resolvedVelocity, normalVelocity);
      resolvedVelocity = add(normalVelocity, clampMagnitude(tangent, Math.sqrt(Math.max(0, maximumSpeed ** 2 - normalSpeed ** 2))));
    }
  }
  return { position, velocity: resolvedVelocity };
}
