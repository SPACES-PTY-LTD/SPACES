import { CircleGeometry, PlaneGeometry, RingGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function merge(parts:BufferGeometry[]) {
  const triangles=parts.map(part=>part.index?part.toNonIndexed():part);
  const result=mergeGeometries(triangles,false)!;
  new Set([...parts,...triangles]).forEach(part=>part.dispose());
  return result;
}
function stroke(width:number,height:number,x:number,y:number,angle=0){
  return new PlaneGeometry(width,height).rotateZ(angle).translate(x,y,.02);
}
// Flat mesh glyphs, rendered and depth-tested entirely inside the WebGL scene.
export function createAttentionIcons(){
  return {
    background:new CircleGeometry(.58,24),
    clock:merge([new RingGeometry(.34,.4,32).translate(0,0,.02),stroke(.055,.24,0,.1),stroke(.21,.055,.09,0)]),
    speed:merge([
      new RingGeometry(.34,.4,24,1,0,Math.PI).translate(0,-.1,.02),
      stroke(.055,.13,-.31,.02,-Math.PI/4),stroke(.055,.13,0,.23),stroke(.055,.13,.31,.02,Math.PI/4),
      stroke(.055,.32,.1,.02,-Math.PI/4),new CircleGeometry(.065,12).translate(0,-.1,.025),
    ]),
  };
}
