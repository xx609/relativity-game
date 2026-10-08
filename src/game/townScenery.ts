import * as THREE from 'three';
import { CLOCKTOWER, COTTAGES, COTTAGE_ROOF_HEIGHT, RAIL_EXTENT, RAIL_LINES } from '../simulation/townLayout';
import { createTownGround } from './townGround';

const material = (color: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });

function box(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], surface: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), surface);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** A gabled roof, with its ridge running left to right. */
function roof(parent: THREE.Object3D, width: number, depth: number, base: number, height: number, surface: THREE.Material): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -width / 2, 0, -depth / 2, -width / 2, 0, depth / 2, -width / 2, height, 0,
    width / 2, 0, -depth / 2, width / 2, 0, depth / 2, width / 2, height, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 3, 5, 4, 0, 2, 3, 2, 5, 3, 1, 4, 2, 2, 4, 5, 0, 3, 1, 1, 3, 4]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.y = base;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function buildTownSquare(world: THREE.Group): void {
  world.add(createTownGround());
  const transform = new THREE.Object3D();
  const timber = material(0x927457);
  const steel = new THREE.MeshStandardMaterial({ color: 0x777a70, roughness: 0.58, metalness: 0.48 });
  for (const z of RAIL_LINES) {
    const track = new THREE.Group();
    track.name = `ground-rail-${z}`;
    for (const lateral of [-0.8, 0.8]) {
      box(track, [RAIL_EXTENT * 2 + 3, 0.055, 0.075], [0, 0.055, z + lateral], steel);
    }
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.025, 2.1), timber, 65);
    for (let index = 0; index < 65; index += 1) {
      transform.position.set((index - 32) * 0.82, 0.042, z);
      transform.updateMatrix();
      ties.setMatrixAt(index, transform.matrix);
    }
    ties.receiveShadow = true;
    track.add(ties);
    world.add(track);
  }

  const cream = material(0xf1e6cc);
  const sandstone = material(0xcfb592);
  const wood = material(0x78634e);
  const roofMaterial = material(0x6e8b7f);
  const tower = new THREE.Group();
  tower.name = 'clocktower';
  tower.position.set(CLOCKTOWER.x, 0, CLOCKTOWER.z);
  world.add(tower);
  // Stack distinct wall sections instead of wrapping coplanar cream walls
  // around a full-height sandstone box (which caused z-fighting).
  box(tower, [CLOCKTOWER.width, 10.9, CLOCKTOWER.depth], [0, 5.45, 0], sandstone);
  box(tower, [4.2, 3.2, 4.2], [0, 12.5, 0], cream);
  const crownHeight = CLOCKTOWER.height - 14.1;
  box(tower, [CLOCKTOWER.width, crownHeight, CLOCKTOWER.depth], [0, 14.1 + crownHeight / 2, 0], sandstone);
  for (const y of [0.18, 8.6, 10.85, 14.5]) box(tower, [4.35, 0.24, 4.35], [0, y, 0], cream);
  for (const x of [-1.95, 1.95]) {
    for (const z of [-1.95, 1.95]) box(tower, [0.22, 10.8, 0.22], [x, 5.4, z], cream);
  }
  box(tower, [1.15, 2.3, 0.08], [0, 1.15, 2.13], wood);
  box(tower, [1.4, 0.14, 0.24], [0, 2.37, 2.17], cream);
  box(tower, [0.48, 1.5, 0.08], [0, 6.5, 2.13], wood);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(CLOCKTOWER.roofWidth / Math.SQRT2, CLOCKTOWER.roofHeight, 4), roofMaterial);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = CLOCKTOWER.height + CLOCKTOWER.roofHeight / 2;
  cap.castShadow = true;
  tower.add(cap);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), material(0xb59750));
  finial.position.y = 18.4;
  tower.add(finial);

  const windowMaterial = material(0x668a8c);
  const shutterMaterial = material(0x819179);
  for (const cottage of COTTAGES) {
    const home = new THREE.Group();
    home.position.set(cottage.x, 0, cottage.z);
    home.rotation.y = cottage.angle;
    home.name = 'village-cottage';
    world.add(home);
    box(home, [cottage.width, cottage.height, cottage.depth], [0, cottage.height / 2, 0], material(cottage.color));
    roof(home, cottage.width + 0.55, cottage.depth + 0.65, cottage.height, COTTAGE_ROOF_HEIGHT, material(cottage.roof));
    box(home, [cottage.width + 0.12, 0.25, cottage.depth + 0.12], [0, 0.15, 0], sandstone);
    box(home, [0.75, 2, 0.85], [cottage.width * 0.28, cottage.height + 1.4, -0.4], sandstone);
    const front = cottage.depth / 2 + 0.035;
    box(home, [1.15, 2.2, 0.1], [0, 1.1, front], wood);
    for (const x of [-cottage.width * 0.3, cottage.width * 0.3]) {
      box(home, [1.4, 1.6, 0.09], [x, 2.4, front], cream);
      box(home, [1.14, 1.32, 0.1], [x, 2.4, front + 0.05], windowMaterial);
      box(home, [0.07, 1.35, 0.12], [x, 2.4, front + 0.1], cream);
      box(home, [1.15, 0.07, 0.12], [x, 2.4, front + 0.1], cream);
      for (const side of [-1, 1]) box(home, [0.32, 1.6, 0.09], [x + side * 0.9, 2.4, front], shutterMaterial);
      box(home, [1.65, 0.22, 0.32], [x, 1.48, front + 0.13], wood);
      box(home, [1.4, 0.23, 0.34], [x, 1.67, front + 0.15], material(0x899a66));
    }
    // A simple striped awning makes the edge buildings feel like small shops.
    for (let stripe = 0; stripe < 7; stripe += 1) {
      const awning = box(home, [0.43, 0.09, 1.15], [(stripe - 3) * 0.43, 2.6, front + 0.55], stripe % 2 ? cream : shutterMaterial);
      awning.rotation.x = 0.18;
    }
  }
}

export function buildTram(entity: { size: { x: number; y: number; z: number }; baseColor: number }): THREE.Group {
  const tram = new THREE.Group();
  const paint = material(entity.baseColor);
  const cream = material(0xf5e7c6);
  const dark = material(0x514f43);
  const glass = material(0x86aaac);
  const length = entity.size.x;
  const width = entity.size.z;
  box(tram, [length, 1.95, width], [0, 0.02, 0], paint);
  box(tram, [length + 0.18, 0.2, width + 0.16], [0, 1.05, 0], cream);
  box(tram, [length + 0.03, 0.09, width + 0.03], [0, -0.17, 0], cream);
  for (const side of [-1, 1]) {
    for (const x of [-1.1, 0, 1.1]) box(tram, [0.85, 0.78, 0.03], [x, 0.48, side * (width / 2 + 0.02)], glass);
    box(tram, [0.04, 0.8, width * 0.72], [side * (length / 2 + 0.02), 0.48, 0], glass);
    for (const x of [-length * 0.3, length * 0.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.17, 12), dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, -1.02, side * 0.8);
      wheel.castShadow = true;
      tram.add(wheel);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), cream);
    lamp.position.set(side * (length / 2 + 0.04), -0.45, 0);
    tram.add(lamp);
  }
  return tram;
}
