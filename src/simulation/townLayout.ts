/** Shared footprints keep the town's architecture and its collisions aligned. */
export const CLOCKTOWER = { x: 0, z: -17, width: 4.2, height: 14.8, depth: 4.2, roofHeight: 3.4, roofWidth: Math.SQRT2 * 3.15 };
export const COTTAGE_ROOF_HEIGHT = 2.3;
export const RAIL_LINES = [-5, 6] as const;
export const RAIL_EXTENT = 26;

export const COTTAGES = [
  { x: -14, z: -28, width: 7, height: 5, depth: 5.8, color: 0xe6c39f, roof: 0xa66450, angle: 0 },
  { x: 12, z: -29, width: 8, height: 5.8, depth: 6, color: 0xf0dfb8, roof: 0x7f8d78, angle: 0 },
  { x: -27, z: -15, width: 7, height: 4.5, depth: 6, color: 0xd5dfca, roof: 0x9b6553, angle: Math.PI / 2 },
  { x: 27, z: -16, width: 8, height: 5.2, depth: 6, color: 0xe9c6ac, roof: 0x9d6557, angle: -Math.PI / 2 },
  { x: -27, z: 19, width: 7.5, height: 4.6, depth: 5.5, color: 0xebdcbf, roof: 0x718477, angle: Math.PI / 2 },
  { x: 27, z: 19, width: 7, height: 5, depth: 5.5, color: 0xe6c9ad, roof: 0xa76950, angle: -Math.PI / 2 },
] as const;
