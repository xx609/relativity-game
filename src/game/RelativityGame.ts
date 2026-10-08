import * as THREE from 'three';
import { InputController } from './InputController';
import {
  closingSpeed,
  lerp,
  lorentzFactor,
  magnitude,
  relativeVelocity,
  simultaneousClockTime,
  vec,
} from '../simulation/relativity';
import {
  MAX_BETA,
  PLAYER_HEIGHT,
  WorldSimulation,
  type WorldEntity,
} from '../simulation/world';
import { contractionMatrix, observerWorldMatrix } from './observerFrame';
import { RelativisticMaterials } from './RelativisticMaterials';
import { CLOCKTOWER } from '../simulation/townLayout';
import { buildTownSquare, buildTram } from './townScenery';

export interface EffectSettings {
  doppler: boolean;
  clocks: boolean;
  contraction: boolean;
  lightDelay: boolean;
  relativistic: boolean;
  reducedMotion: boolean;
  lowDistortion: boolean;
}

export interface TargetInfo {
  id: string;
  name: string;
  speed: number;
  closingSpeed: number;
  maxClosingSpeed: number;
}

export interface FrameInfo {
  playerSpeed: number;
  playerRatio: number;
  gamma: number;
  flying: boolean;
  grounded: boolean;
  altitude: number;
  target: TargetInfo | null;
}

interface EntityVisual {
  group: THREE.Group;
  clockHand: THREE.Object3D | null;
  arrow: THREE.Mesh;
  emitterBeta: { value: THREE.Vector3 };
}

interface SpacetimeFeature {
  group: THREE.Group;
  update: (time: number, ratio: number) => void;
  dispose: () => void;
}

const FIXED_STEP = 1 / 60;
export class RelativityGame {
  readonly simulation = new WorldSimulation();
  readonly input: InputController;
  readonly effects: EffectSettings = {
    doppler: true,
    clocks: true,
    contraction: true,
    lightDelay: true,
    relativistic: true,
    reducedMotion: false,
    lowDistortion: false,
  };

  onFrame: ((frame: FrameInfo) => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly world = new THREE.Group();
  // Improve depth precision while retaining clearance against contracted walls.
  private readonly camera = new THREE.PerspectiveCamera(72, 1, 0.03, 600);
  private readonly materialEffects = new RelativisticMaterials();
  private readonly referenceClocks: Array<{ group: THREE.Group; hand: THREE.Object3D }> = [];
  private readonly observerBeta = new THREE.Vector3();
  private observerPosition = vec(0, PLAYER_HEIGHT, 16);
  private renderTime = 0;
  private contractionAmount = 1;
  private relativityAmount = 1;
  private delayAmount = 0;
  private readonly visuals = new Map<string, EntityVisual>();
  private readonly pickable: THREE.Object3D[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();
  private animationFrame = 0;
  private accumulator = 0;
  private spacetime: SpacetimeFeature | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.input = new InputController(canvas);
    canvas.addEventListener('looklockchange', (event) => {
      const locked = (event as CustomEvent<boolean>).detail;
      this.onLockChange?.(locked);
    });

    this.buildWorld();
    void this.loadAmbientDetails();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  start(): void {
    this.clock.start();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.input.destroy();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.spacetime?.dispose();
  }

  requestPointerLock(): void {
    this.input.requestLock();
  }

  setLightSpeed(value: number): void {
    this.simulation.setLightSpeed(value);
  }

  setFov(value: number): void {
    this.camera.fov = value;
    this.camera.userData.baseFov = value;
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.simulation.reset();
    this.input.reset();
    this.input.yaw = 0;
    this.input.pitch = 0;
    this.accumulator = 0;
    this.observerBeta.set(0, 0, 0);
  }

  async setSpacetimeGrid(enabled: boolean): Promise<void> {
    if (enabled && !this.spacetime) {
      const { createSpacetimeGrid } = await import('../features/spacetimeGrid');
      this.spacetime = createSpacetimeGrid();
      this.world.add(this.spacetime.group);
      this.materialEffects.attach(this.spacetime.group);
    }
    if (this.spacetime) this.spacetime.group.visible = enabled;
  }

  private readonly tick = (): void => {
    this.animationFrame = requestAnimationFrame(this.tick);
    const frameDelta = Math.min(this.clock.getDelta(), 0.1);
    this.accumulator += frameDelta;
    while (this.accumulator >= FIXED_STEP) {
      // Consume queued presses exactly once, at a physics step (not a render).
      this.simulation.step(FIXED_STEP, this.input.movement());
      this.accumulator -= FIXED_STEP;
    }

    const alpha = this.simulation.paused ? 1 : this.accumulator / FIXED_STEP;
    this.renderTime = this.simulation.previousTime + (this.simulation.time - this.simulation.previousTime) * alpha;
    this.observerPosition = lerp(this.simulation.previousPlayer.position, this.simulation.player.position, alpha);
    this.updateObserverFrame(frameDelta, alpha);
    this.updateCamera();
    this.updateEntities(frameDelta);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const target = this.pickTarget();
    const speed = magnitude(this.simulation.player.velocity);
    const ratio = speed / this.simulation.lightSpeed;
    this.spacetime?.update(this.effects.reducedMotion ? 0 : this.renderTime, this.effects.reducedMotion ? 0 : ratio);
    this.onFrame?.({
      playerSpeed: speed,
      playerRatio: ratio,
      gamma: lorentzFactor(speed, this.simulation.lightSpeed),
      flying: this.simulation.player.flying,
      grounded: this.simulation.player.grounded,
      altitude: Math.max(0, this.observerPosition.y - PLAYER_HEIGHT),
      target,
    });

    this.renderer.render(this.scene, this.camera);
  };

  private updateCamera(): void {
    const position = this.observerPosition;
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.input.yaw;
    this.camera.rotation.x = this.input.pitch;
  }

  private updateObserverFrame(deltaSeconds: number, alpha: number): void {
    const blend = 1 - Math.exp(-(this.effects.lowDistortion ? 4 : 10) * deltaSeconds);
    const velocity = lerp(this.simulation.previousPlayer.velocity, this.simulation.player.velocity, alpha);
    this.observerBeta.lerp(new THREE.Vector3(velocity.x, velocity.y, velocity.z).divideScalar(this.simulation.lightSpeed), blend);
    this.observerBeta.clampLength(0, MAX_BETA);
    const enabled = this.effects.relativistic;
    this.relativityAmount += (Number(enabled) - this.relativityAmount) * blend;
    this.contractionAmount += (Number(enabled && this.effects.contraction) - this.contractionAmount) * blend;
    this.delayAmount += (Number(enabled && this.effects.lightDelay) - this.delayAmount) * blend;
    const dopplerStrength = Number(enabled && this.effects.doppler) * (this.effects.lowDistortion ? 0.45 : 1);
    this.materialEffects.strength.value += (dopplerStrength - this.materialEffects.strength.value) * blend;
    this.world.matrix.copy(observerWorldMatrix(this.observerPosition, this.observerBeta, 1, this.contractionAmount));
    this.world.matrixWorldNeedsUpdate = true;
    this.materialEffects.observerBeta.value.copy(this.observerBeta);
    this.materialEffects.observerPosition.value.set(this.observerPosition.x, this.observerPosition.y, this.observerPosition.z);
    this.materialEffects.inverseWorld.value.copy(this.world.matrix).invert();
  }

  private updateEntities(deltaSeconds: number): void {
    const inverseContraction = contractionMatrix(this.observerBeta, 1, this.contractionAmount).invert();
    const blend = 1 - Math.exp(-10 * deltaSeconds);
    for (const entity of this.simulation.entities) {
      const visual = this.visuals.get(entity.id);
      if (!visual) continue;
      const current = this.simulation.getVisibleState(entity, this.observerPosition, false, this.renderTime);
      const delayed = this.delayAmount > 0.00001
        ? this.simulation.getVisibleState(entity, this.observerPosition, true, this.renderTime) : current;
      const position = lerp(current.position, delayed.position, this.delayAmount);
      const velocity = lerp(current.velocity, delayed.velocity, this.delayAmount);
      const targetBeta = new THREE.Vector3(velocity.x, velocity.y, velocity.z).divideScalar(this.simulation.lightSpeed);
      visual.emitterBeta.value.lerp(targetBeta, blend).clampLength(0, MAX_BETA);
      const relative = relativeVelocity(visual.emitterBeta.value, this.observerBeta, 1);
      // Cancel the shared spatial scale for local geometry, then apply exactly
      // one contraction in the object's full relative-velocity direction.
      visual.group.matrix.copy(inverseContraction).multiply(contractionMatrix(relative, 1, this.contractionAmount));
      visual.group.matrix.setPosition(position.x, position.y, position.z);
      visual.group.matrixWorldNeedsUpdate = true;

      if (visual.clockHand) {
        visual.clockHand.visible = this.effects.clocks;
        const simultaneous = simultaneousClockTime(current.properTime, current.position,
          visual.emitterBeta.value.clone().multiplyScalar(this.simulation.lightSpeed), this.observerPosition,
          this.observerBeta.clone().multiplyScalar(this.simulation.lightSpeed), this.simulation.lightSpeed);
        const simultaneousTime = current.properTime + (simultaneous - current.properTime) * this.relativityAmount;
        const properTime = simultaneousTime + (delayed.properTime - simultaneousTime) * this.delayAmount;
        visual.clockHand.rotation.z = -properTime * Math.PI * 0.8;
      }

      const arrowDirection = new THREE.Vector3(velocity.x, 0, velocity.z);
      if (arrowDirection.lengthSq() > 0.01) {
        const targetRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDirection.normalize());
        visual.arrow.quaternion.slerp(targetRotation, blend);
      }
    }
    for (const clock of this.referenceClocks) {
      clock.hand.visible = this.effects.clocks;
      const separation = clock.group.position.clone().sub(new THREE.Vector3(this.observerPosition.x, this.observerPosition.y, this.observerPosition.z));
      const delay = separation.length() / this.simulation.lightSpeed;
      const simultaneity = this.observerBeta.dot(separation) / this.simulation.lightSpeed * this.relativityAmount;
      clock.hand.rotation.z = -(this.renderTime + simultaneity * (1 - this.delayAmount) - delay * this.delayAmount) * Math.PI * 0.8;
    }
  }

  private pickTarget(): TargetInfo | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 42;
    const hit = this.raycaster.intersectObjects(this.pickable, true)[0];
    const id = hit?.object.userData.entityId as string | undefined;
    if (!id) {
      return null;
    }
    const entity = this.simulation.entities.find((candidate) => candidate.id === id);
    if (!entity) return null;
    const closing = closingSpeed(
      entity.position,
      entity.velocity,
      this.simulation.player.position,
      this.simulation.player.velocity,
      this.simulation.lightSpeed,
    );
    return {
      id,
      name: entity.shortName,
      speed: magnitude(relativeVelocity(entity.velocity, this.simulation.player.velocity, this.simulation.lightSpeed)),
      closingSpeed: closing,
      maxClosingSpeed: this.simulation.lightSpeed,
    };
  }

  private buildWorld(): void {
    this.world.name = 'observer-relative-world';
    this.world.matrixAutoUpdate = false;
    this.scene.add(this.world);
    this.scene.background = new THREE.Color(0xc8e1df);
    this.scene.fog = new THREE.Fog(0xc8e1df, 65, 180);

    const hemisphere = new THREE.HemisphereLight(0xe4f1ef, 0xa79b74, 2.3);
    this.world.add(hemisphere);
    const key = new THREE.DirectionalLight(0xffe5b4, 2.7);
    key.position.set(-25, 38, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -45;
    key.shadow.camera.right = 45;
    key.shadow.camera.top = 45;
    key.shadow.camera.bottom = -45;
    key.shadow.camera.far = 120;
    key.shadow.normalBias = 0.05;
    this.world.add(key, key.target);

    buildTownSquare(this.world);
    this.buildReferenceClocks();
    for (const entity of this.simulation.entities) this.buildEntity(entity);
    this.materialEffects.attach(this.world);
    this.camera.userData.baseFov = this.camera.fov;
  }

  private buildReferenceClocks(): void {
    for (let side = 0; side < 4; side += 1) {
      const angle = side * Math.PI / 2;
      const clock = this.createClock(1.28, 0x66583f);
      clock.group.position.set(
        CLOCKTOWER.x + Math.sin(angle) * 2.14, 12.6,
        CLOCKTOWER.z + Math.cos(angle) * 2.14,
      );
      clock.group.rotation.y = angle;
      this.world.add(clock.group);
      this.referenceClocks.push(clock);
    }
  }

  private buildEntity(entity: WorldEntity): void {
    const group = new THREE.Group();
    group.name = entity.id;
    group.matrixAutoUpdate = false;
    group.position.set(entity.position.x, entity.position.y, entity.position.z);
    const tram = buildTram(entity);
    tram.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id;
    });
    group.add(tram);

    const clock = this.createClock(0.28, 0x66583f);
    clock.group.position.set(0, -0.58, entity.size.z * 0.5 + 0.04);
    group.add(clock.group);

    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.4, 4),
      new THREE.MeshStandardMaterial({ color: 0xa0834b, roughness: 0.8 }),
    );
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.y = 1.5;
    group.add(arrow);

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.entityId) this.pickable.push(child);
    });
    const emitterBeta = { value: new THREE.Vector3(entity.velocity.x, entity.velocity.y, entity.velocity.z).divideScalar(this.simulation.lightSpeed) };
    this.materialEffects.attach(group, emitterBeta);
    this.visuals.set(entity.id, {
      group,
      clockHand: clock.hand,
      arrow,
      emitterBeta,
    });
    this.world.add(group);
  }

  private createClock(radius: number, color: number): { group: THREE.Group; hand: THREE.Object3D } {
    const group = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff1d2, roughness: 0.9, side: THREE.DoubleSide }),
    );
    group.add(face);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, radius * 0.055, 5, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
    );
    rim.position.z = 0.015;
    group.add(rim);
    const ink = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.04, radius * (index % 3 === 0 ? 0.18 : 0.1), 0.018), ink);
      tick.position.set(Math.sin(angle) * radius * 0.82, Math.cos(angle) * radius * 0.82, 0.025);
      tick.rotation.z = -angle;
      group.add(tick);
    }
    const hour = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.07, radius * 0.48, 0.025), ink);
    hour.position.set(radius * 0.14, radius * 0.1, 0.035);
    hour.rotation.z = -Math.PI / 3;
    group.add(hour);
    const hand = new THREE.Group();
    const handMesh = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.055, radius * 0.7, radius * 0.035),
      ink,
    );
    handMesh.position.y = radius * 0.28;
    hand.add(handMesh);
    hand.position.z = 0.04;
    group.add(hand);
    return { group, hand };
  }

  private async loadAmbientDetails(): Promise<void> {
    const { addAmbientDetails } = await import('../features/ambientDetails');
    addAmbientDetails(this.world);
    this.materialEffects.attach(this.world);
  }

  private readonly resize = (): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };
}
