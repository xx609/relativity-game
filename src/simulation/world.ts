import {
  add,
  addRelativisticVelocities,
  clampMagnitude,
  lerp,
  magnitude,
  properTimeRate,
  scale,
  contractionFactor,
  type Vec3,
  vec,
} from './relativity';
import { moveWithCollisions, type Collider } from './collision';

export const DEFAULT_LIGHT_SPEED = 12;
export const MAX_BETA = 0.985;
export const PLAYER_HEIGHT = 1.7;
export const ROOM_HALF_SIZE = 30;
const GRAVITY = 14;
const JUMP_SPEED = 6;

export interface MovementInput {
  forward: number;
  right: number;
  sprint: boolean;
  yaw: number;
  pitch: number;
  jump: boolean;
  vertical: number;
  toggleFlight: boolean;
}

export interface RailDefinition {
  axis: 'x' | 'z';
  minimum: number;
  maximum: number;
  cruiseSpeed: number;
  direction: 1 | -1;
}

export interface WorldEntity {
  id: string;
  shortName: string;
  kind: 'courier' | 'pod' | 'orb';
  position: Vec3;
  velocity: Vec3;
  rail: RailDefinition;
  baseColor: number;
  properTime: number;
  size: Vec3;
}

interface HistorySample {
  time: number;
  position: Vec3;
  velocity: Vec3;
  properTime: number;
}

export interface SampledEntityState {
  position: Vec3;
  velocity: Vec3;
  properTime: number;
}

const INITIAL_ENTITIES: ReadonlyArray<Omit<WorldEntity, 'properTime'>> = [
  {
    id: 'cyan-courier', shortName: 'COURIER 01', kind: 'courier',
    position: { x: -10, y: 1.35, z: -10 }, velocity: { x: 5.2, y: 0, z: 0 },
    rail: { axis: 'x', minimum: -24, maximum: 24, cruiseSpeed: 5.2, direction: 1 },
    baseColor: 0x55ddea, size: { x: 4.1, y: 1.45, z: 2.1 },
  },
  {
    id: 'amber-courier', shortName: 'COURIER 02', kind: 'courier',
    position: { x: 5.5, y: 1.35, z: 10 }, velocity: { x: -4.1, y: 0, z: 0 },
    rail: { axis: 'x', minimum: -24, maximum: 24, cruiseSpeed: 4.1, direction: -1 },
    baseColor: 0xf2a65a, size: { x: 3.5, y: 1.35, z: 2 },
  },
  {
    id: 'violet-pod', shortName: 'POD 03', kind: 'pod',
    position: { x: 14, y: 1.5, z: -21 }, velocity: { x: 0, y: 0, z: 3.4 },
    rail: { axis: 'z', minimum: -24, maximum: 24, cruiseSpeed: 3.4, direction: 1 },
    baseColor: 0xb68cff, size: { x: 2, y: 2.1, z: 3.2 },
  },
  {
    id: 'signal-orb', shortName: 'SIGNAL 04', kind: 'orb',
    position: { x: -14, y: 2.2, z: 19 }, velocity: { x: 0, y: 0, z: -2.5 },
    rail: { axis: 'z', minimum: -23, maximum: 23, cruiseSpeed: 2.5, direction: -1 },
    baseColor: 0xf472b6, size: { x: 1.8, y: 1.8, z: 1.8 },
  },
];

function copyEntity(source: Omit<WorldEntity, 'properTime'>): WorldEntity {
  return {
    ...source,
    position: { ...source.position },
    velocity: { ...source.velocity },
    rail: { ...source.rail },
    size: { ...source.size },
    properTime: 0,
  };
}

export class WorldSimulation {
  lightSpeed = DEFAULT_LIGHT_SPEED;
  private targetLightSpeed = DEFAULT_LIGHT_SPEED;
  time = 0;
  paused = false;
  readonly player = {
    position: vec(0, PLAYER_HEIGHT, 16),
    velocity: vec(),
    flying: false,
    grounded: true,
  };
  readonly previousPlayer = { position: vec(0, PLAYER_HEIGHT, 16), velocity: vec() };
  previousTime = 0;
  entities: WorldEntity[] = INITIAL_ENTITIES.map(copyEntity);
  private readonly history = new Map<string, HistorySample[]>();

  constructor() {
    this.recordHistory();
  }

  setLightSpeed(next: number): void {
    if (Number.isFinite(next)) this.targetLightSpeed = Math.max(1, next);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  togglePaused(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  reset(): void {
    this.time = 0;
    this.paused = false;
    this.lightSpeed = DEFAULT_LIGHT_SPEED;
    this.targetLightSpeed = DEFAULT_LIGHT_SPEED;
    this.player.position = vec(0, PLAYER_HEIGHT, 16);
    this.player.velocity = vec();
    this.player.flying = false;
    this.player.grounded = true;
    this.previousPlayer.position = { ...this.player.position };
    this.previousPlayer.velocity = vec();
    this.previousTime = 0;
    this.entities = INITIAL_ENTITIES.map(copyEntity);
    this.history.clear();
    this.recordHistory();
  }

  step(deltaSeconds: number, input: MovementInput): void {
    if (this.paused || deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) return;
    this.previousPlayer.position = { ...this.player.position };
    this.previousPlayer.velocity = { ...this.player.velocity };
    this.previousTime = this.time;
    const previousLightSpeed = this.lightSpeed;
    this.lightSpeed += (this.targetLightSpeed - this.lightSpeed) * (1 - Math.exp(-5 * deltaSeconds));
    if (this.lightSpeed < previousLightSpeed) {
      // Preserve beta while c eases downward; don't briefly make bodies superluminal.
      const ratio = this.lightSpeed / previousLightSpeed;
      this.player.velocity = scale(this.player.velocity, ratio);
      for (const entity of this.entities) entity.velocity = scale(entity.velocity, ratio);
    }
    this.time += deltaSeconds;
    const before = this.entities.map((entity) => ({ ...entity.position }));
    for (const entity of this.entities) this.stepEntity(entity, deltaSeconds);
    const colliders = this.createColliders();
    this.entities.forEach((entity, index) => {
      const start = before[index]!;
      colliders.push({
        center: start,
        halfSize: entityHalfSize(entity, this.lightSpeed),
        velocity: vec((entity.position.x - start.x) / deltaSeconds, 0, (entity.position.z - start.z) / deltaSeconds),
      });
    });
    this.stepPlayer(deltaSeconds, input, colliders);
    this.recordHistory();
  }

  private stepPlayer(deltaSeconds: number, input: MovementInput, colliders: Collider[]): void {
    if (input.toggleFlight) {
      this.player.flying = !this.player.flying;
      // Start hovering immediately, including when flight is enabled mid-fall.
      this.player.velocity.y = 0;
    }
    if (input.jump && this.player.grounded && !this.player.flying) {
      this.player.velocity = addRelativisticVelocities(this.player.velocity, vec(0, JUMP_SPEED, 0), this.lightSpeed);
      this.player.grounded = false;
    }
    const sin = Math.sin(input.yaw);
    const cos = Math.cos(input.yaw);
    const pitch = this.player.flying ? input.pitch : 0;
    const forward = vec(-sin * Math.cos(pitch), Math.sin(pitch), -cos * Math.cos(pitch));
    const right = vec(cos, 0, -sin);
    let wish = add(scale(forward, input.forward), scale(right, input.right));
    if (this.player.flying) wish.y += input.vertical;
    const wishLength = magnitude(wish);
    if (wishLength > 1) wish = scale(wish, 1 / wishLength);

    if (wishLength > 0) {
      const acceleration = input.sprint ? 10.5 : 7.5;
      const localDelta = scale(wish, acceleration * deltaSeconds);
      this.player.velocity = addRelativisticVelocities(this.player.velocity, localDelta, this.lightSpeed);
    } else {
      const damping = Math.exp(-3.5 * deltaSeconds);
      this.player.velocity.x *= damping;
      this.player.velocity.z *= damping;
      if (this.player.flying) this.player.velocity.y *= damping;
    }

    if (!this.player.flying) {
      this.player.velocity = addRelativisticVelocities(this.player.velocity, vec(0, -GRAVITY * deltaSeconds, 0), this.lightSpeed);
    }
    this.player.velocity = clampMagnitude(this.player.velocity, this.lightSpeed * MAX_BETA);
    const halfHeight = PLAYER_HEIGHT / 2;
    const bodyCenter = add(this.player.position, vec(0, -halfHeight, 0));
    const moved = moveWithCollisions(bodyCenter, this.player.velocity, deltaSeconds, colliders, 0.38, this.lightSpeed * MAX_BETA, halfHeight);
    this.player.position = add(moved.position, vec(0, halfHeight, 0));
    this.player.velocity = moved.velocity;
    this.player.grounded = moved.grounded;
  }

  private createColliders(): Collider[] {
    const colliders: Collider[] = [
      { center: vec(0, -1, 0), halfSize: vec(Infinity, 1, Infinity), velocity: vec() },
    ];
    for (const sign of [-1, 1]) {
      colliders.push({ center: vec(sign * 30.2, 4, 0), halfSize: vec(0.225, 4, 31), velocity: vec() });
      colliders.push({ center: vec(0, 4, sign * 30.2), halfSize: vec(31, 4, 0.225), velocity: vec() });
    }
    // Conservative footprints for the central platform and peripheral plinths.
    colliders.push({ center: vec(0, 0.33, 0), halfSize: vec(5.1, 0.325, 5.1), velocity: vec() });
    for (let index = 0; index < 18; index += 1) {
      const angle = index / 18 * Math.PI * 2;
      const radius = ROOM_HALF_SIZE - 3.2 - index % 3 * 0.55;
      const height = 0.7 + index % 4 * 0.35;
      colliders.push({ center: vec(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius), halfSize: vec(0.75, height / 2, 0.75), velocity: vec() });
    }
    return colliders;
  }

  private stepEntity(entity: WorldEntity, deltaSeconds: number): void {
    const { rail } = entity;
    const maximumSpeed = this.lightSpeed * MAX_BETA;
    const distanceToEnd = rail.direction > 0 ? rail.maximum - entity.position[rail.axis] : entity.position[rail.axis] - rail.minimum;
    // Brake before the end, then reverse through zero instead of clamping the position.
    if (distanceToEnd < 0.25 && Math.abs(entity.velocity[rail.axis]) < 0.8) rail.direction *= -1;
    const cruise = Math.min(rail.cruiseSpeed, maximumSpeed * 0.98);
    const remaining = rail.direction > 0 ? rail.maximum - entity.position[rail.axis] : entity.position[rail.axis] - rail.minimum;
    const targetSpeed = Math.min(cruise, Math.max(0, remaining) * 2) * rail.direction;
    const target = rail.axis === 'x' ? vec(targetSpeed, 0, 0) : vec(0, 0, targetSpeed);
    const blend = 1 - Math.exp(-5 * deltaSeconds);
    entity.velocity = lerp(entity.velocity, target, blend);
    entity.velocity = clampMagnitude(entity.velocity, maximumSpeed);
    entity.position = add(entity.position, scale(entity.velocity, deltaSeconds));

    entity.properTime += deltaSeconds * properTimeRate(magnitude(entity.velocity), this.lightSpeed);
  }

  /** Bracketed light-cone intersection stays stable near c and at close range. */
  getVisibleState(entity: WorldEntity, observerPosition: Vec3, useLightDelay: boolean, observationTime = this.time): SampledEntityState {
    const samples = this.history.get(entity.id);
    if (!samples?.length) return { position: { ...entity.position }, velocity: { ...entity.velocity }, properTime: entity.properTime };
    if (!useLightDelay) return this.sampleHistory(samples, observationTime);
    const residual = (time: number): number => {
      const state = this.sampleHistory(samples, time);
      const dx = state.position.x - observerPosition.x;
      const dy = state.position.y - observerPosition.y;
      const dz = state.position.z - observerPosition.z;
      return time + Math.hypot(dx, dy, dz) / this.lightSpeed - observationTime;
    };
    let low = samples[0]!.time;
    let high = observationTime;
    if (residual(low) >= 0) return this.sampleHistory(samples, low);
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const middle = (low + high) / 2;
      if (residual(middle) > 0) high = middle;
      else low = middle;
    }
    return this.sampleHistory(samples, (low + high) / 2);
  }

  private sampleHistory(samples: HistorySample[], time: number): SampledEntityState {
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (!first || !last) return { position: vec(), velocity: vec(), properTime: 0 };
    if (time <= first.time) return { position: { ...first.position }, velocity: { ...first.velocity }, properTime: first.properTime };
    if (time >= last.time) return { position: { ...last.position }, velocity: { ...last.velocity }, properTime: last.properTime };

    let low = 0;
    let high = samples.length - 1;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if ((samples[middle]?.time ?? 0) <= time) low = middle;
      else high = middle;
    }
    const before = samples[low] ?? first;
    const after = samples[high] ?? last;
    const amount = (time - before.time) / Math.max(after.time - before.time, 1e-9);
    return {
      position: lerp(before.position, after.position, amount),
      velocity: lerp(before.velocity, after.velocity, amount),
      properTime: before.properTime + (after.properTime - before.properTime) * amount,
    };
  }

  private recordHistory(): void {
    const oldestAllowed = this.time - Math.max(16, ROOM_HALF_SIZE * 3 / this.lightSpeed);
    for (const entity of this.entities) {
      const samples = this.history.get(entity.id) ?? [];
      samples.push({
        time: this.time,
        position: { ...entity.position },
        velocity: { ...entity.velocity },
        properTime: entity.properTime,
      });
      while ((samples[1]?.time ?? Number.POSITIVE_INFINITY) < oldestAllowed) samples.shift();
      this.history.set(entity.id, samples);
    }
  }
}

export function entityHalfSize(entity: WorldEntity, lightSpeed: number): Vec3 {
  const half = entity.kind === 'courier'
    ? vec(entity.size.x * 0.55 + 0.6, entity.size.y / 2, entity.size.z / 2 + 0.1)
    : entity.kind === 'pod' ? vec(1.45, 1.5, 1.75) : vec(1.6, 1.6, 1.6);
  half[entity.rail.axis] *= contractionFactor(magnitude(entity.velocity), lightSpeed);
  return half;
}

export function cappedEntitySpeed(entity: WorldEntity, lightSpeed: number): number {
  return magnitude(clampMagnitude(entity.velocity, lightSpeed * MAX_BETA));
}
