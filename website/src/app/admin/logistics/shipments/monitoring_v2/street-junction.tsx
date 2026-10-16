import type { StreetJunction } from './model';

// Illustrative signals, not live traffic instructions. Fixed phases avoid implying live data.
function Signal({green=false}:{green?:boolean}) {
  return <group position={[-3.15,0,3.65]}>
    <mesh position={[0,1.1,0]} castShadow><cylinderGeometry args={[.055,.075,2.2,8]}/><meshStandardMaterial color="#657180"/></mesh>
    <mesh position={[0,2.25,0]} castShadow><boxGeometry args={[.34,.85,.26]}/><meshStandardMaterial color="#26313d"/></mesh>
    {['#fa5656','#efb946','#48c98c'].map((color,i)=><mesh key={color} position={[0,2.5-i*.25,.145]}><sphereGeometry args={[.09,10,8]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={(green?i===2:i===0)?1.2:0.05}/></mesh>)}
  </group>;
}
export function StreetIntersection({junction}:{junction:StreetJunction}) {
  const round=junction.kind==='roundabout';
  return <group position={[junction.x,0,junction.z]}>
    {/* Coplanar asphalt with depth bias avoids both raised seams and z-fighting. */}
    <mesh position={[0,-.01,0]} rotation={[-Math.PI/2,0,0]}>
      {round?<circleGeometry args={[4.25,48]}/>:<planeGeometry args={[5,5]}/>}
      <meshStandardMaterial color="#8d97a5" roughness={.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>
    {!round && [0,Math.PI/2,Math.PI,-Math.PI/2].filter(angle=>!junction.arms.includes(angle)).map(angle=><group key={`edge-${angle}`} rotation={[0,angle,0]}><mesh position={[0,.005,2.35]}><boxGeometry args={[5,.015,.055]}/><meshBasicMaterial color="#f9fafb"/></mesh></group>)}
    {round && <>
      <mesh position={[0,.15,0]} receiveShadow><cylinderGeometry args={[1.45,1.55,.23,40]}/><meshStandardMaterial color="#e1e5e9"/></mesh>
      <mesh position={[0,.28,0]}><cylinderGeometry args={[1.28,1.28,.08,40]}/><meshStandardMaterial color="#91ac79"/></mesh>
      <mesh position={[0,.012,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.85,2.92,64]}/><meshBasicMaterial color="#f8fafc"/></mesh>
      {[0,1,2,3].map(i=><group key={i} rotation={[0,i*Math.PI/2,0]}><mesh position={[2.3,.012,0]} rotation={[-Math.PI/2,0,-Math.PI/2]}><circleGeometry args={[.23,3]}/><meshBasicMaterial color="#f8fafc"/></mesh></group>)}
    </>}
    {junction.kind!=='bend' && junction.arms.map(angle=><group key={angle} rotation={[0,angle,0]}>
      {round?<>{[0,1,2].map(n=><mesh key={n} position={[-.35-n*.45,.012,4.5]}><boxGeometry args={[.25,.02,.16]}/><meshBasicMaterial color="#f8fafc"/></mesh>)}</>:<><mesh position={[-1.2,.012,3.25]}><boxGeometry args={[2,.02,.16]}/><meshBasicMaterial color="#f8fafc"/></mesh><Signal green={Math.abs(angle)===Math.PI/2}/></>}
    </group>)}
  </group>;
}
