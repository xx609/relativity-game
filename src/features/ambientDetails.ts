import * as THREE from 'three';

/** Soft landscape at the edges; decorative planting never blocks the player. */
export function addAmbientDetails(scene: THREE.Object3D): void {
  const group = new THREE.Group();
  group.name = 'village-gardens';
  const surface = (color: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  const trunk = surface(0x8e7458);
  const leaves = [surface(0x7d9f67), surface(0x93ae70), surface(0xb0b67a), surface(0x658c6b)];
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.28, 3.5, 7);
  const trees: Array<[number, number, number]> = [
    [-18, -18, 1.05], [18, -21, 1.2], [-20, 14, 1], [20, 14, 1.05],
    [-20, 25, 1.2], [21, 28, 1.1], [-7, -32, 1.1], [22, -32, 1.15],
    [-35, -8, 1.3], [35, -5, 1.15], [-37, 17, 1.25], [36, 12, 1.35],
    [-34, -32, 1.4], [34, -37, 1.5], [-16, -42, 1.5], [5, -40, 1.4],
  ];
  trees.forEach(([x, z, scale], index) => {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    const stem = new THREE.Mesh(trunkGeometry, trunk);
    stem.position.y = 1.75;
    stem.castShadow = true;
    tree.add(stem);
    for (let lobe = 0; lobe < 3; lobe += 1) {
      const crown = new THREE.Mesh(crownGeometry, leaves[(index + lobe) % leaves.length]);
      crown.position.set(Math.cos(lobe * 2.3) * 0.65, 3.5 + lobe * 0.5, Math.sin(lobe * 2.3) * 0.6);
      crown.scale.set(1.9, 1.8, 1.7);
      crown.rotation.y = index * 1.4 + lobe;
      crown.castShadow = true;
      crown.receiveShadow = true;
      tree.add(crown);
    }
    group.add(tree);
  });
  const hillGeometry = new THREE.IcosahedronGeometry(1, 2);
  for (let index = 0; index < 11; index += 1) {
    const angle = index / 11 * Math.PI * 2;
    const hill = new THREE.Mesh(hillGeometry, surface(index % 2 ? 0x95b398 : 0xa8bf9a));
    hill.position.set(Math.cos(angle) * 115, -7, Math.sin(angle) * 115);
    hill.scale.set(34 + index % 3 * 9, 19 + index % 4 * 4, 31);
    group.add(hill);
  }
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xfff9e9, fog: true });
  for (let index = 0; index < 8; index += 1) {
    const cloud = new THREE.Group();
    const angle = index / 8 * Math.PI * 2;
    cloud.position.set(Math.cos(angle) * 78, 30 + index % 3 * 5, Math.sin(angle) * 78);
    for (let puff = 0; puff < 3; puff += 1) {
      const mesh = new THREE.Mesh(crownGeometry, cloudMaterial);
      mesh.position.set((puff - 1) * 3.8, puff === 1 ? 0.8 : 0, 0);
      mesh.scale.set(5, 1.5 + puff % 2, 2.4);
      cloud.add(mesh);
    }
    group.add(cloud);
  }
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), surface(0xffffff), 320);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.025, 0.22, 3), surface(0x6e8e55), 320);
  const transform = new THREE.Object3D();
  const colors = [0xf4dfa1, 0xe8a58a, 0xf6edce, 0xb6a2c4];
  for (let index = 0; index < 320; index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * (22 + (Math.sin(index * 7.3) * 0.5 + 0.5) * 3);
    const z = Math.sin(index * 4.17) * 28;
    transform.position.set(x, 0.25, z);
    transform.updateMatrix();
    flowers.setMatrixAt(index, transform.matrix);
    flowers.setColorAt(index, new THREE.Color(colors[index % colors.length]));
    transform.position.y = 0.11;
    transform.updateMatrix();
    stems.setMatrixAt(index, transform.matrix);
  }
  group.add(flowers, stems);
  scene.add(group);
}
