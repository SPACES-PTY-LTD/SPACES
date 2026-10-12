import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape, TorusGeometry, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Position = [number, number, number];
function at(geometry: BufferGeometry, position: Position, rotation: Position = [0, 0, 0]) {
  geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
  return geometry.translate(...position);
}
function box(size: Position, position: Position, rotation?: Position) {
  return at(new BoxGeometry(...size), position, rotation);
}
function rounded(size: Position, position: Position, radius = 0.025) {
  return at(new RoundedBoxGeometry(...size, 2, radius), position);
}
function batch(parts: BufferGeometry[]) {
  const triangles = parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(triangles, false);
  if (!geometry) throw new Error("Unable to build the refined truck model");
  for (const part of new Set([...parts, ...triangles])) part.dispose();
  geometry.computeBoundingBox();
  return geometry;
}

const cab = new Shape();
cab.moveTo(-1.055, 0.285);
cab.lineTo(-1.055, 0.525);
cab.lineTo(-0.945, 0.805);
cab.lineTo(-0.405, 0.805);
cab.lineTo(-0.365, 0.75);
cab.lineTo(-0.365, 0.285);
cab.closePath();

const painted = [
  rounded([1.36, 0.78, 0.88], [0.375, 0.68, 0]),
  at(new ExtrudeGeometry(cab, { depth: 0.79, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 1 }), [0, 0, -0.395]),
  box([0.018, 0.61, 0.72], [1.066, 0.675, 0]),
];
const dark = [
  rounded([2.12, 0.105, 0.76], [0, 0.235, 0], 0.01),
  rounded([0.08, 0.12, 0.8], [-1.082, 0.265, 0], 0.01),
  box([0.055, 0.065, 0.84], [1.07, 0.235, 0]),
  box([0.025, 0.155, 0.54], [-1.075, 0.42, 0]),
];
const windows = [box([0.024, 0.225, 0.59], [-1.011, 0.667, 0], [0, 0, -0.374])];
const metal: BufferGeometry[] = [
  box([0.025, 0.51, 0.015], [1.083, 0.675, 0]),
];
const tyres: BufferGeometry[] = [];
const lights: BufferGeometry[] = [];
const rearLights: BufferGeometry[] = [];
for (const side of [-1, 1]) {
  windows.push(rounded([0.31, 0.225, 0.018], [-0.64, 0.668, side * 0.412], 0.008));
  dark.push(
    rounded([0.055, 0.15, 0.05], [-0.55, 0.655, side * 0.565], 0.008),
    box([0.022, 0.028, 0.13], [-0.55, 0.72, side * 0.497]),
    box([0.075, 0.015, 0.019], [-0.465, 0.505, side * 0.418]),
  );
  metal.push(box([0.59, 0.065, 0.035], [-0.22, 0.28, side * 0.424]));
  lights.push(box([0.023, 0.09, 0.09], [-1.078, 0.37, side * 0.342]));
  rearLights.push(box([0.025, 0.065, 0.065], [1.082, 0.28, side * 0.355]));
  for (const wheelX of [-0.765, 0.715]) {
    tyres.push(at(new CylinderGeometry(0.18, 0.18, 0.115, 16), [wheelX, 0.18, side * 0.435], [Math.PI / 2, 0, 0]));
    metal.push(at(new CylinderGeometry(0.103, 0.103, 0.018, 16), [wheelX, 0.18, side * 0.499], [Math.PI / 2, 0, 0]));
    dark.push(at(new TorusGeometry(0.2, 0.026, 6, 16, Math.PI), [wheelX, 0.18, side * 0.449]));
  }
}
for (const y of [0.38, 0.42, 0.46]) metal.push(box([0.012, 0.01, 0.455], [-1.092, y, 0]));

// Reuse immutable geometry across the entire fleet; batch by material to limit draw calls.
export const REFINED_TRUCK_GEOMETRIES = {
  painted: batch(painted),
  dark: batch(dark),
  windows: batch(windows),
  metal: batch(metal),
  tyres: batch(tyres),
  lights: batch(lights),
  rearLights: batch(rearLights),
};
