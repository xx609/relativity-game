export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const ZERO: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 0 });

export function vec(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(value: Vec3, scalar: number): Vec3 {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function magnitudeSquared(value: Vec3): number {
  return dot(value, value);
}

export function magnitude(value: Vec3): number {
  return Math.sqrt(magnitudeSquared(value));
}

export function normalized(value: Vec3): Vec3 {
  const length = magnitude(value);
  return length > 1e-9 ? scale(value, 1 / length) : vec();
}

export function lerp(a: Vec3, b: Vec3, amount: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount,
  };
}

export function clampMagnitude(value: Vec3, maximum: number): Vec3 {
  const length = magnitude(value);
  return length > maximum && length > 0 ? scale(value, maximum / length) : { ...value };
}

/** Lorentz factor for a massive body. Returns a finite value at the configured safety limit. */
export function lorentzFactor(speed: number, lightSpeed: number): number {
  const beta = Math.min(Math.abs(speed) / lightSpeed, 0.999_999);
  return 1 / Math.sqrt(1 - beta * beta);
}

export function properTimeRate(speed: number, lightSpeed: number): number {
  return 1 / lorentzFactor(speed, lightSpeed);
}

export function contractionFactor(speed: number, lightSpeed: number): number {
  return properTimeRate(speed, lightSpeed);
}

/** Full 3D velocity in the observer's instantaneous inertial frame. */
export function relativeVelocity(object: Vec3, observer: Vec3, lightSpeed: number): Vec3 {
  return addRelativisticVelocities(scale(observer, -1), object, lightSpeed);
}

/** Local inertial approximation to the clock event simultaneous for the observer. */
export function simultaneousClockTime(
  properTime: number, objectPosition: Vec3, objectVelocity: Vec3,
  observerPosition: Vec3, observerVelocity: Vec3, lightSpeed: number,
): number {
  const timeOffset = dot(observerVelocity, subtract(objectPosition, observerPosition))
    / Math.max(lightSpeed * lightSpeed - dot(observerVelocity, objectVelocity), 1e-8);
  return properTime + timeOffset * properTimeRate(magnitude(objectVelocity), lightSpeed);
}

/**
 * Adds a velocity measured in a moving local frame to that frame's velocity.
 * The decomposition follows the vector form of Einstein velocity addition.
 */
export function addRelativisticVelocities(frame: Vec3, local: Vec3, lightSpeed: number): Vec3 {
  const frameSpeed = magnitude(frame);
  if (frameSpeed < 1e-9) return clampMagnitude(local, lightSpeed * 0.999_999);

  const frameDirection = scale(frame, 1 / frameSpeed);
  const localParallelScalar = dot(local, frameDirection);
  const localParallel = scale(frameDirection, localParallelScalar);
  const localPerpendicular = subtract(local, localParallel);
  const gamma = lorentzFactor(frameSpeed, lightSpeed);
  const denominator = 1 + dot(frame, local) / (lightSpeed * lightSpeed);

  const numerator = add(add(frame, localParallel), scale(localPerpendicular, 1 / gamma));
  return clampMagnitude(scale(numerator, 1 / Math.max(denominator, 1e-6)), lightSpeed * 0.999_999);
}

/** Signed 1D relative speed along an arbitrary axis. Positive means the object moves along the axis. */
export function relativeVelocityAlong(
  objectVelocity: Vec3,
  observerVelocity: Vec3,
  axis: Vec3,
  lightSpeed: number,
): number {
  const unitAxis = normalized(axis);
  return dot(relativeVelocity(objectVelocity, observerVelocity, lightSpeed), unitAxis);
}

/** Positive values indicate closing motion along the line from observer to object. */
export function closingSpeed(
  objectPosition: Vec3,
  objectVelocity: Vec3,
  observerPosition: Vec3,
  observerVelocity: Vec3,
  lightSpeed: number,
): number {
  const sightline = subtract(objectPosition, observerPosition);
  return -relativeVelocityAlong(objectVelocity, observerVelocity, sightline, lightSpeed);
}

/** Longitudinal relativistic Doppler factor: greater than one is blue-shifted. */
export function dopplerFactor(closingVelocity: number, lightSpeed: number): number {
  const beta = Math.max(-0.999_999, Math.min(0.999_999, closingVelocity / lightSpeed));
  return Math.sqrt((1 + beta) / (1 - beta));
}

export function smoothLimitVelocity(
  velocity: Vec3,
  lightSpeed: number,
  maxBeta: number,
  deltaSeconds: number,
  response = 8,
): Vec3 {
  const maximum = lightSpeed * maxBeta;
  const limited = clampMagnitude(velocity, maximum);
  if (magnitudeSquared(limited) === magnitudeSquared(velocity)) return limited;
  const blend = 1 - Math.exp(-response * deltaSeconds);
  return lerp(velocity, limited, blend);
}
