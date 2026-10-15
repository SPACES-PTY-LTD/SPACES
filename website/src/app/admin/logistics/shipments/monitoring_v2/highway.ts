export const HIGHWAY_HEIGHT = 10;

/** Smooth, level joins at both decks; width follows the actual highway lane count. */
export function rampSection(t: number, frontZ: number, highwayZ: number, highwayDepth: number) {
  const progress = Math.max(0, Math.min(1, t));
  const angle = Math.PI / 2 - progress * Math.PI;
  const radius = (frontZ - highwayZ) / 2;
  const blend = progress * progress * (3 - 2 * progress);
  return {
    x: Math.cos(angle) * radius,
    y: HIGHWAY_HEIGHT * blend,
    z: (frontZ + highwayZ) / 2 + Math.sin(angle) * radius,
    width: 5 + (highwayDepth - 5) * blend,
    radialX: Math.cos(angle),
    radialZ: Math.sin(angle),
  };
}
