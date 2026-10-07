import * as THREE from 'three';

/** Nonessential props loaded after the player enters the world. */
export function addAmbientDetails(scene: THREE.Object3D, roomHalfSize: number): void {
  const group = new THREE.Group();
  group.name = 'lazy-ambient-details';
  const material = new THREE.MeshStandardMaterial({ color: 0x1d3946, roughness: 0.72, metalness: 0.2 });
  const emissive = new THREE.MeshBasicMaterial({ color: 0x4bbccd, transparent: true, opacity: 0.56 });

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const radius = roomHalfSize - 3.2 - (index % 3) * 0.55;
    const height = 0.7 + (index % 4) * 0.35;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, height, 5), material);
    plinth.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    plinth.rotation.y = -angle;
    plinth.castShadow = true;
    group.add(plinth);

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.38), emissive);
    light.position.set(plinth.position.x, height + 0.03, plinth.position.z);
    group.add(light);
  }

  scene.add(group);
}
