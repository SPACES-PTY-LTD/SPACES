'use client';
import { Html, MapControls, OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { MOUSE, TOUCH, Object3D, type InstancedMesh, type OrthographicCamera as Camera } from 'three';
import type { OrbitControls } from 'three-stdlib';
import { LOCATION_TYPE_ICONS } from '@/lib/location-type-icons';
import type { Placement, SitePlacement } from './model';

const palette=['#ff526e','#ffba38','#40bcd0','#9770d8','#42b38d','#f28b45'];
function Surface({x,z,width,depth,color,y=0}:{x:number;z:number;width:number;depth:number;color:string;y?:number}) {
  return <mesh position={[x,y,z]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[width,depth]}/><meshBasicMaterial color={color} toneMapped={false}/></mesh>;
}
/** Capsule roads share their height, so their unions have no raised junction seams. */
function Street({x,z,length,vertical=false,width=3}:{x:number;z:number;length:number;vertical?:boolean;width?:number}) {
  return <group position={[x,0,z]} rotation={[0,vertical?Math.PI/2:0,0]}>{[['#d8ceb7',width+.45,.005],['#fffdf5',width,.015]].map(([color,w,y])=><group key={color}>
    <Surface x={0} z={0} width={length} depth={w as number} color={color as string} y={y as number}/>
    {[-1,1].map(side=><mesh key={side} rotation={[-Math.PI/2,0,0]} position={[side*length/2,y as number,0]}><circleGeometry args={[(w as number)/2,16]}/><meshBasicMaterial color={color as string} toneMapped={false}/></mesh>)}
  </group>)}</group>;
}
function MiniBays({placements,location}:{placements:Placement[];location:string|null}) {
  const mesh=useRef<InstancedMesh>(null);
  const bays=useMemo(()=>placements.filter(p=>p.vehicle.status==='at_location' && (!location || p.vehicle.locationId===location)),[placements,location]);
  useLayoutEffect(()=>{
    if(!mesh.current)return;
    const object=new Object3D();
    bays.forEach((p,i)=>{object.position.set(p.x,.03,p.z+.67);object.updateMatrix();mesh.current!.setMatrixAt(i,object.matrix);});
    mesh.current.instanceMatrix.needsUpdate=true;
  },[bays]);
  return <instancedMesh ref={mesh} key={bays.length} args={[undefined,undefined,bays.length]} frustumCulled={false} raycast={()=>null}><boxGeometry args={[2.5,.02,.06]}/><meshBasicMaterial color="#fffdf5"/></instancedMesh>;
}
function MiniCamera({points,focus,zoom,mode,isolated}:{points:{x:number;z:number}[];focus:string;zoom:number;mode:'pan'|'rotate';isolated:boolean}) {
  const camera=useRef<Camera>(null),controls=useRef<OrbitControls>(null);
  const {size,invalidate,camera:activeCamera}=useThree();
  const minX=Math.min(...(points.length?points:[{x:0,z:0}]).map(p=>p.x-5)),maxX=Math.max(...(points.length?points:[{x:10,z:10}]).map(p=>p.x+5));
  const minZ=Math.min(...(points.length?points:[{x:0,z:0}]).map(p=>p.z-5)),maxZ=Math.max(...(points.length?points:[{x:10,z:10}]).map(p=>p.z+5));
  // Numeric extents avoid snapping when API objects refresh or reorder.
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  const fit=Math.min(size.width/(maxX-minX+10),size.height/(maxZ-minZ+10))*.88;
  useEffect(()=>{
    if(!camera.current || !controls.current)return;
    camera.current.position.set(cx,200,cz+.001);camera.current.lookAt(cx,0,cz);
    camera.current.zoom=Math.max(fit*(isolated?.8:.35),Math.min(Math.max(80,fit*8),fit*Math.pow(1.25,zoom)));camera.current.updateProjectionMatrix();
    controls.current.target.set(cx,0,cz);controls.current.update();invalidate();
  },[cx,cz,fit,zoom,focus,invalidate,activeCamera,isolated]);
  return <><OrthographicCamera ref={camera} makeDefault near={.1} far={2000} position={[0,200,0]}/><MapControls ref={controls} makeDefault enableDamping dampingFactor={.08} screenSpacePanning={false}
    minPolarAngle={0} maxPolarAngle={0} minZoom={isolated?fit*.8:fit*.35} maxZoom={Math.max(80,fit*8)} zoomToCursor
    mouseButtons={{LEFT:mode==='rotate'?MOUSE.ROTATE:MOUSE.PAN,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.ROTATE}}
    touches={{ONE:mode==='rotate'?TOUCH.ROTATE:TOUCH.PAN,TWO:TOUCH.DOLLY_ROTATE}}/></>;
}
export function MiniEnvironment({sites,placements,roads,crossStreets,location,selected,group,highwayFocus,locationsFocus,focus,zoom,mode,visibleIds,onLocation,onGroup,hover,setHover,children}:{sites:SitePlacement[];placements:Placement[];roads:number[];crossStreets:{x:number;from:number;to:number}[];location:string|null;selected:string|null;group?:string;highwayFocus?:boolean;locationsFocus?:boolean;focus:number;zoom:number;mode:'pan'|'rotate';visibleIds:Set<string>;onLocation:(id:string)=>void;onGroup:(id:string)=>void;hover:string|null;setHover:(id:string|null)=>void;children:ReactNode}) {
  const visibleSites=sites.filter(s=>(!location || s.id===location) && s.vehicles.some(v=>visibleIds.has(v.id)));
  const transit=placements.filter(p=>p.vehicle.status==='in_transit');
  const left=-7,right=Math.max(12,...sites.map(s=>s.x+(s.yardWidth??12))),bottom=roads[roads.length-1];
  const north=Math.min(-14,...transit.map(p=>p.z)),highwayDepth=-10-north;
  const selectedPoint=placements.find(p=>p.vehicle.id===selected);
  const site=sites.find(s=>s.id===location);
  const points=useMemo(()=>{
    if(site)return [{x:site.x-4,z:site.z-7},{x:site.x+(site.yardWidth??12),z:site.z+(site.yardDepth??12)},...placements.filter(p=>p.vehicle.locationId===site.id && p.vehicle.status==='standby')];
    if(group)return placements.filter(p=>p.vehicle.status===group);
    if(selectedPoint)return [{x:selectedPoint.x-8,z:selectedPoint.z-8},{x:selectedPoint.x+8,z:selectedPoint.z+8}];
    if(highwayFocus && transit.length)return transit;
    const bounds=sites.flatMap(s=>[{x:s.x-4,z:s.z-6},{x:s.x+(s.yardWidth??12),z:s.z+(s.yardDepth??12)}]);
    return locationsFocus?bounds:[...bounds,...placements];
  },[site,selectedPoint,group,placements,highwayFocus,transit,sites,locationsFocus]);
  return <>
    <color attach="background" args={['#f6f0df']}/><ambientLight intensity={1.7}/><directionalLight position={[-20,40,15]} intensity={1.4}/>
    {!location && <>
      {roads.map(z=><Street key={z} x={(left+right)/2} z={z} length={right-left}/>)}
      {[left,right].map(x=><Street key={x} x={x} z={(north+bottom)/2} length={bottom-north} vertical/>)}
      {crossStreets.map(s=><Street key={`${s.x}:${s.from}`} x={s.x} z={(s.from+s.to)/2} length={s.to-s.from} vertical/>)}
      <Street x={(left+right)/2} z={(north-10)/2} length={right-left} width={highwayDepth+2}/>
    </>}
    {location && site && <Street x={site.x+(site.yardWidth??12)/2-2} z={site.roadZ} length={site.yardWidth??12}/>}
    <MiniBays placements={placements} location={location}/>
    {visibleSites.map(s=>{
      const index=Math.max(0,LOCATION_TYPE_ICONS.findIndex(t=>t.value===s.icon)),color=palette[index%palette.length];
      const parked=placements.filter(p=>p.vehicle.locationId===s.id && p.vehicle.status==='at_location');
      const aisles=[...new Set(parked.map(p=>p.x+1.65))];
      return <group key={s.id}>
        <Surface x={s.x+(s.yardWidth??12)/2-2} z={s.z+(s.yardDepth??12)/2-3} width={s.yardWidth??12} depth={s.yardDepth??12} color="#e8dfc9" y={-.02}/>
        {aisles.map(x=><Street key={x} x={x} z={s.z+(s.yardDepth??12)/2-4} length={(s.yardDepth??12)+4} vertical width={1.2}/>)}
        <group position={[s.x,0,s.z+2]} onClick={e=>{e.stopPropagation();onLocation(s.id);}} onPointerOver={e=>{e.stopPropagation();setHover(s.id);}} onPointerOut={()=>setHover(null)}>
          <mesh position={[0,.3,0]}><boxGeometry args={[5,.6,5]}/><meshStandardMaterial color={color}/></mesh>
          <mesh position={[0,1,0]}><boxGeometry args={[3.8,1.4,3.8]}/><meshStandardMaterial color={color}/></mesh>
          {/* A fixed roof motif and colour identify each catalog type without detailed assets. */}
          {Array.from({length:1+Math.floor(index/6)},(_,i)=><mesh key={i} position={[-1.15+(i%3)*1.15,1.82,-.9+Math.floor(i/3)*1.5]}>{index%2?<cylinderGeometry args={[.35,.35,.22,12]}/>:<boxGeometry args={[.65,.22,.85]}/>}<meshBasicMaterial color="#fff5d9"/></mesh>)}
          {hover===s.id && <Html position={[0,3,0]} center style={{pointerEvents:'none'}}><div className="mv-truck-label">{s.name}</div></Html>}
        </group>
      </group>;
    })}
    {(['standby','unknown'] as const).map(status=>{const ps=placements.filter(p=>p.vehicle.status===status && visibleIds.has(p.vehicle.id) && (!location || p.vehicle.locationId===location));if(!ps.length)return null;const minX=Math.min(...ps.map(p=>p.x)),maxX=Math.max(...ps.map(p=>p.x)),minZ=Math.min(...ps.map(p=>p.z)),maxZ=Math.max(...ps.map(p=>p.z));return <group key={status}><Surface x={(minX+maxX)/2} z={(minZ+maxZ)/2} width={maxX-minX+4} depth={maxZ-minZ+4} color={status==='standby'?'#dce6d3':'#e6ddda'} y={-.01}/><Html position={[(minX+maxX)/2,1,minZ-3]} center><button className="mv-area-label" onClick={()=>onGroup(status)}>{status==='standby'?'Standby':'Unknown location'}</button></Html></group>;})}
    {children}
    <MiniCamera points={points} focus={`${focus}:${location}:${selected}:${group}:${highwayFocus}:${locationsFocus}`} zoom={zoom} mode={mode} isolated={!!location || !!selected}/>
  </>;
}
