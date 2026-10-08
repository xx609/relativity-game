import * as THREE from 'three';
import { RAIL_EXTENT, RAIL_LINES } from '../simulation/townLayout';

function pavingTexture(): THREE.DataTexture {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const row = Math.floor(y / 64);
    for (let x = 0; x < size; x += 1) {
      const offsetX = (x + (row % 2) * 32) % size;
      const column = Math.floor(offsetX / 64);
      const grout = y % 64 < 2 || offsetX % 64 < 2;
      const shade = 0.96 + ((column * 3 + row * 7) % 7) * 0.012;
      const color = grout ? [201, 189, 162] : [222 * shade, 209 * shade, 181 * shade];
      const index = (y * size + x) * 4;
      pixels[index] = color[0]!;
      pixels[index + 1] = color[1]!;
      pixels[index + 2] = color[2]!;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Grass, paving, and gravel share edges, never overlapping depth layers. */
export function createTownGround(): THREE.Mesh {
  const trackEnd = RAIL_EXTENT + 1.5;
  const xEdges = [-700, -trackEnd, -21.5, 21.5, trackEnd, 700];
  const zEdges = [-700, -27, ...RAIL_LINES.flatMap((z) => [z - 1.25, z + 1.25]), 24, 700];
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < zEdges.length - 1; row += 1) {
    const z0 = zEdges[row]!;
    const z1 = zEdges[row + 1]!;
    for (let column = 0; column < xEdges.length - 1; column += 1) {
      const x0 = xEdges[column]!;
      const x1 = xEdges[column + 1]!;
      const x = (x0 + x1) / 2;
      const z = (z0 + z1) / 2;
      const onTrack = Math.abs(x) < trackEnd && RAIL_LINES.some((line) => Math.abs(z - line) < 1.25);
      const inSquare = Math.abs(x) < 21.5 && z > -27 && z < 24;
      const first = positions.length / 3;
      positions.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x1, 0, z0);
      uvs.push(x0 / 8, z0 / 8, x0 / 8, z1 / 8, x1 / 8, z1 / 8, x1 / 8, z0 / 8);
      geometry.addGroup(indices.length, 6, onTrack ? 2 : inSquare ? 1 : 0);
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, [
    new THREE.MeshStandardMaterial({ color: 0x91ac73, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: 0xb3a78e, roughness: 0.92 }),
  ]);
  ground.name = 'meadow-ground';
  ground.receiveShadow = true;
  return ground;
}
