import * as THREE from 'three';

export interface SpacetimeGrid {
  group: THREE.Group;
  update: (time: number, speedRatio: number) => void;
  dispose: () => void;
}

export function createSpacetimeGrid(): SpacetimeGrid {
  const group = new THREE.Group();
  group.name = 'spacetime-grid';
  const material = new THREE.LineBasicMaterial({
    color: 0x75e7ee,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rings: THREE.LineLoop[] = [];

  for (let index = 0; index < 8; index += 1) {
    const radius = 5 + index * 3.3;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step < 64; step += 1) {
      const angle = step / 64 * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0.09, Math.sin(angle) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const ring = new THREE.LineLoop(geometry, material);
    ring.userData.baseRadius = radius;
    rings.push(ring);
    group.add(ring);
  }

  return {
    group,
    update(time, speedRatio) {
      group.rotation.y = time * 0.035;
      for (let index = 0; index < rings.length; index += 1) {
        const ring = rings[index];
        if (!ring) continue;
        const pulse = 1 + Math.sin(time * 1.8 - index * 0.65) * 0.025 * (0.25 + speedRatio);
        ring.scale.setScalar(pulse);
      }
      material.opacity = 0.16 + speedRatio * 0.3;
    },
    dispose() {
      for (const ring of rings) ring.geometry.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
