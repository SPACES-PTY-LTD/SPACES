// V2-only architecture: the original monitor retains its existing facility meshes.
export function Depot({onSelect}:{onSelect:()=>void}) {
 return <group onClick={e=>{e.stopPropagation();onSelect();}}>
  <mesh receiveShadow position={[0,.04,-1]}><boxGeometry args={[12,.12,7]}/><meshStandardMaterial color="#d2d9e3"/></mesh>
  <mesh castShadow receiveShadow position={[0,1.65,-1.8]}><boxGeometry args={[10.8,3.3,5]}/><meshStandardMaterial color="#e4e8ee" roughness={.82}/></mesh>
  <mesh castShadow receiveShadow position={[0,3.38,-1.8]} rotation={[0,0,.025]}><boxGeometry args={[11.3,.18,5.5]}/><meshStandardMaterial color="#b3c1d4" roughness={.6} metalness={.12}/></mesh>
  {Array.from({length:15},(_,i)=><mesh key={`rib-${i}`} position={[-5.3+i*.75,3.5,-1.8]}><boxGeometry args={[.04,.06,5.4]}/><meshStandardMaterial color="#d2dce9"/></mesh>)}
  {[-3.5,0,3.5].map(x=><group key={x}>
   {[-3,-.8].map(z=><mesh key={z} position={[x,3.53,z]}><boxGeometry args={[1.7,.04,.8]}/><meshStandardMaterial color="#e9f0fa" roughness={.35}/></mesh>)}
   <mesh castShadow position={[x,1.25,.75]}><boxGeometry args={[2.3,2.5,.18]}/><meshStandardMaterial color="#547293"/></mesh>
   <mesh position={[x,1.1,.86]}><boxGeometry args={[1.95,2.15,.07]}/><meshStandardMaterial color="#7289a6"/></mesh>
   {Array.from({length:10},(_,i)=><mesh key={i} position={[x,.17+i*.22,.91]}><boxGeometry args={[1.95,.025,.015]}/><meshStandardMaterial color="#a7b7cb"/></mesh>)}
   <mesh position={[x,.1,1.2]}><boxGeometry args={[2.6,.18,1]}/><meshStandardMaterial color="#a7b1bf"/></mesh>
   {[-1.3,1.3].map(dx=><mesh key={dx} position={[x+dx,.4,1.05]}><cylinderGeometry args={[.06,.06,.8,8]}/><meshStandardMaterial color="#e6b945"/></mesh>)}
  </group>)}
  {[-5.3,5.3].map(x=><mesh key={x} position={[x,1.6,.76]}><boxGeometry args={[.12,3.2,.15]}/><meshStandardMaterial color="#9faec1"/></mesh>)}
  {[0,1,2,3].map(i=><group key={i} position={[-5.5+(i%2)*.8,.1,1.8+Math.floor(i/2)*.8]}><mesh position={[0,.06,0]}><boxGeometry args={[.72,.12,.65]}/><meshStandardMaterial color="#a78c5e"/></mesh><mesh position={[0,.42,0]} castShadow><boxGeometry args={[.65,.65,.58]}/><meshStandardMaterial color="#d8c698"/></mesh><mesh position={[0,.42,.3]}><boxGeometry args={[.04,.65,.02]}/><meshStandardMaterial color="#eee0b5"/></mesh></group>)}
  <mesh castShadow position={[6,1,-.5]}><boxGeometry args={[1.5,2,1.7]}/><meshStandardMaterial color="#e1e7ef"/></mesh><mesh position={[6,2.07,-.5]}><boxGeometry args={[1.7,.15,1.9]}/><meshStandardMaterial color="#a0b0c6"/></mesh><mesh position={[6,1.3,.36]}><boxGeometry args={[1,.65,.04]}/><meshStandardMaterial color="#4e728b"/></mesh>
 </group>;
}
