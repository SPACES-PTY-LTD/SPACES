'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, MapControls } from '@react-three/drei';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Color, MOUSE, TOUCH, Object3D, Vector3, type Group, type InstancedMesh } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import { REFINED_TRUCK_GEOMETRIES } from '../monitoring/components/refined-truck-geometry';
import { Depot } from './depot';
import { HIGHWAY_HEIGHT } from './highway';
import { HighwayRamp } from './highway-ramp';
import { LocationMesh } from '../monitoring/components/location-meshes';
import { resolveLocationMeshType } from '@/lib/location-type-icons';
import { Building2, Clock3, ParkingCircle, CircleHelp } from 'lucide-react';
import { StreetIntersection } from './street-junction';
import { streetFurniture, layoutFleet, SlotRegistry, waiting, type MonitorVehicle, type CameraView, type Placement } from './model';

const parts=Object.keys(REFINED_TRUCK_GEOMETRIES) as (keyof typeof REFINED_TRUCK_GEOMETRIES)[];
const colours:Record<string,string>={dark:'#26313d',windows:'#426b82',metal:'#a9b4c2',tyres:'#18212a',lights:'#fff1d5',rearLights:'#be2932',painted:'#e2e8ef'};
type SceneProps={roadLayout:'single'|'multiple';interactionMode:'pan'|'rotate';fleet:MonitorVehicle[];visibleIds:Set<string>;selected:string|null;location:string|null;camera:CameraView;zoom:number;focus:number;paused:boolean;showLabels:boolean;group?:'standby'|'unknown';now:number;onVehicle:(id:string)=>void;onLocation:(id:string)=>void;onGroup:(group:string)=>void;onFailure:()=>void;journey?:{from:string;to:string}|null;onPerformance?:(fps:number)=>void};
function FleetMeshes({placements,selected,paused,now,onVehicle,onPerformance}:Pick<SceneProps,'selected'|'paused'|'now'|'onVehicle'|'onPerformance'> & {placements:Placement[]}) {
  const refs=useRef<Partial<Record<keyof typeof REFINED_TRUCK_GEOMETRIES,InstancedMesh>>>({});
  const [hover,setHover]=useState<string|null>(null);
  const clock=useRef(0);const frames=useRef({time:0,count:0}); const object=useMemo(()=>new Object3D(),[]);const colour=useMemo(()=>new Color(),[]);
  const positions=useRef(new Map<string,Vector3>());
  useFrame((_,delta)=>{
    frames.current.time+=delta;frames.current.count++;if(frames.current.time>=2){onPerformance?.(Math.round(frames.current.count/frames.current.time));frames.current={time:0,count:0};}
    if(!paused) clock.current+=Math.min(delta,.05);
    for(let i=0;i<placements.length;i++){
      const p=placements[i];
      const moving=p.vehicle.status==='in_transit';
      const x=p.x+(moving?Math.sin(clock.current*.16+i*.7)*.65:0);
      let current=positions.current.get(p.vehicle.id);
      const target=new Vector3(x,p.y ?? 0,p.z);
      if(!current){current=target.clone();positions.current.set(p.vehicle.id,current);}
      // Changes are derived from snapshots; never synthesize arrivals or delivery events.
      if(paused) current.copy(target); else current.lerp(target,Math.min(1,delta*3));
      object.position.copy(current);object.rotation.set(0,p.rotation,0);object.updateMatrix();
      for(const part of parts) refs.current[part]?.setMatrixAt(i,object.matrix);
      const alert=p.vehicle.speeding || waiting(p.vehicle,now).overdue;
      colour.set(alert?'#ef4444':p.vehicle.id===selected?'#1463ff':p.vehicle.id===hover?'#a7b4c6':'#e0e6ed');
      refs.current.painted?.setColorAt(i,colour);
    }
    for(const part of parts){const mesh=refs.current[part];if(mesh){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}}
  });
  const active=placements.find(p=>p.vehicle.id===(hover || selected));
  return <>
    {parts.map(part=><instancedMesh key={`${part}-${placements.length}`} ref={mesh=>{if(mesh)refs.current[part]=mesh;}} args={[REFINED_TRUCK_GEOMETRIES[part],undefined,placements.length]} frustumCulled={false} castShadow={placements.length<250} receiveShadow
      onClick={e=>{e.stopPropagation();if(e.instanceId!==undefined)onVehicle(placements[e.instanceId].vehicle.id);}}
      onPointerMove={e=>{e.stopPropagation();if(e.instanceId!==undefined)setHover(placements[e.instanceId].vehicle.id);}}
      onPointerOut={()=>setHover(null)}>
      <meshStandardMaterial color={colours[part]} roughness={part==='windows'?.3:.78} metalness={part==='metal'?.35:0}/>
    </instancedMesh>)}
    {active && <Html position={[active.x,(active.y ?? 0)+2,active.z]} center zIndexRange={[10,0]}><button className="mv-truck-label" onClick={()=>onVehicle(active.vehicle.id)}>{active.vehicle.plate}</button></Html>}
    {placements.filter(p=>p.vehicle.id===selected).map(p=><mesh key={p.vehicle.id} position={[p.x,(p.y ?? 0)+.04,p.z]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.45,1.52,48]}/><meshBasicMaterial color="#1463ff"/></mesh>)}
  </>;
}
function Road({x=0,y=0,z,width,depth=5,moving=false,paused=false}:{x?:number;y?:number;z:number;width:number;depth?:number;moving?:boolean;paused?:boolean}) {
  const dividers=useRef<Group>(null);
  const travel=useRef(0);
  useFrame((_,delta)=>{
    if(!moving || paused || !dividers.current)return;
    const span=Math.max(1,width-1.1);
    travel.current=(travel.current+Math.min(delta,.05))%span;
    dividers.current.children.forEach((dash,index)=>{
      // Match V1's scrolling road illusion; keep every dash inside the deck.
      dash.position.x=-width/2+.55+((index*2-travel.current)%span+span)%span;
    });
  });
  return <group position={[x,y,z]}>
    <mesh receiveShadow position={[0,-.12,0]}><boxGeometry args={[width,.22,depth]}/><meshStandardMaterial color="#8d97a5" roughness={.95}/></mesh>
    {[-1,1].map(side=><mesh key={side} position={[0,.005,side*(depth/2-.15)]}><boxGeometry args={[width,.015,.055]}/><meshBasicMaterial color="#f9fafb"/></mesh>)}
    <group ref={dividers}>{Array.from({length:Math.floor((width-1.1)/2)+1},(_,i)=><mesh key={i} position={[-width/2+i*2+.55,.012,0]}><boxGeometry args={[1.1,.02,.07]}/><meshBasicMaterial color="#f8fafc"/></mesh>)}</group>
  </group>;
}
function Tree({x,z}:{x:number;z:number}) { return <group position={[x,0,z]}><mesh position={[0,.65,0]} castShadow><cylinderGeometry args={[.12,.18,1.3,6]}/><meshStandardMaterial color="#766955"/></mesh><mesh position={[0,1.7,0]} castShadow><icosahedronGeometry args={[.8,1]}/><meshStandardMaterial color="#89a76c" roughness={1}/></mesh><mesh position={[.15,2.2,0]} castShadow><icosahedronGeometry args={[.57,1]}/><meshStandardMaterial color="#94af75" roughness={1}/></mesh></group>; }
function Lamp({x,z}:{x:number;z:number}) {return <group position={[x,0,z]}><mesh position={[0,1.45,0]}><cylinderGeometry args={[.035,.055,2.9,6]}/><meshStandardMaterial color="#606c7d"/></mesh><mesh position={[.22,2.9,0]}><boxGeometry args={[.55,.08,.16]}/><meshStandardMaterial color="#536071"/></mesh></group>;}
function Camera({camera,zoom,focus,selected,location,placements,sites,paused,roadZ,interactionMode,extent,compact,centreX}:{interactionMode:'pan'|'rotate';camera:CameraView;zoom:number;focus:number;selected:string|null;location:string|null;placements:Placement[];sites:{id:string;x:number;z:number;direction?:number}[];paused:boolean;roadZ:number;extent:number;compact:boolean;centreX:number}) {
  const controls=useRef<Controls>(null);const {camera:cam,gl}=useThree();
  const target=useRef(new Vector3());const destination=useRef(new Vector3(50,48,65));const moving=useRef(true);
  // Keep this callback stable: Drei reconnects input listeners when it changes.
  const cancelCameraMotion=useCallback(()=>{moving.current=false;},[]);
  const selectedPosition=placements.find(p=>p.vehicle.id===selected);const site=sites.find(s=>s.id===location);
  const anchorY=selectedPosition?.y ?? 0;
  const facing=site?.direction ?? (selectedPosition?.vehicle.status==='at_location'?sites.find(s=>s.id===selectedPosition.vehicle.locationId)?.direction:1) ?? 1;
  const keepAboveGround=useCallback(()=>{
    if(!controls.current)return;
    // Ground-plane pan plus a height floor also protects cursor-focused dolly.
    controls.current.target.y=anchorY;
    if(cam.position.y<anchorY+1){cam.position.setY(anchorY+1);cam.lookAt(controls.current.target);}
  },[cam,anchorY]);

  // Camera responds to navigation, not each live clock tick or background refresh.
  const anchorX=selectedPosition?.x ?? site?.x ?? centreX, anchorZ=selectedPosition?.z ?? site?.z ?? roadZ;
  useEffect(()=>{
    const close=Boolean(selected || location);target.current.set(anchorX,anchorY,anchorZ);
    const distance=(close?(location?28:18):camera==='overview'?extent:55)*Math.pow(.8,zoom);
    // Look along the parallel roads so both yard rows and the joining ramp read together.
    const overview=camera==='overview' && !close;
    destination.current.set(anchorX+(camera==='top'?.01:camera==='road'?-distance*.6:-distance*(overview?(compact?.65:.95):.4)),anchorY+(camera==='top'?distance*1.5:camera==='road'?distance*.3:distance*(overview?(compact?1.1:.78):.68)),anchorZ+(camera==='top'?.01:distance*(overview?(compact?1:-.16):1)*facing));moving.current=true;
  },[camera,zoom,focus,selected,location,anchorX,anchorY,anchorZ,facing,extent,compact]);
  useFrame((_,delta)=>{if(!controls.current || !moving.current)return;cam.position.lerp(destination.current,paused?1:Math.min(1,delta*5));controls.current.target.lerp(target.current,paused?1:Math.min(1,delta*5));controls.current.update();if(cam.position.distanceTo(destination.current)<.05)moving.current=false;});
  return <MapControls ref={controls} domElement={gl.domElement} makeDefault
    enablePan enableZoom enableRotate enableDamping dampingFactor={0.05}
    screenSpacePanning={false} zoomToCursor zoomSpeed={1.15} panSpeed={1.1}
    mouseButtons={{LEFT:interactionMode==='rotate'?MOUSE.ROTATE:MOUSE.PAN,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.ROTATE}}
    touches={{ONE:interactionMode==='rotate'?TOUCH.ROTATE:TOUCH.PAN,TWO:TOUCH.DOLLY_ROTATE}}
    minDistance={5} maxDistance={500} maxPolarAngle={Math.PI/2.12}
    onStart={cancelCameraMotion} onChange={keepAboveGround}/>;
}
function World(props:SceneProps) {
  const [registry]=useState(()=>new SlotRegistry());
  const layout=useMemo(()=>layoutFleet(props.fleet,registry,props.journey?'single':props.roadLayout),[props.fleet,registry,props.roadLayout,props.journey]);
  const sites=props.journey?[{id:'journey-from',name:props.journey.from,address:'Collection',icon:'warehouse',vehicles:[],x:-19,z:0,direction:1,roadZ:10},{id:'journey-to',name:props.journey.to,address:'Destination',icon:'warehouse',vehicles:[],x:19,z:0,direction:1,roadZ:10}]:layout.sites;
  const placements=props.journey?layout.placements.filter(p=>p.vehicle.id===props.selected).map(p=>({...p,x:0,y:0,z:10,rotation:0})):layout.placements.map(p=>({...p,y:p.vehicle.status==='in_transit'?HIGHWAY_HEIGHT:0}));
  const visible=placements.filter(p=>props.visibleIds.has(p.vehicle.id));
  const visibleSites=props.journey?sites:sites.filter(s=>s.vehicles.some(v=>props.visibleIds.has(v.id)));
  const grouped=props.group?placements.filter(p=>p.vehicle.status===props.group):[];
  const groupSite=grouped.length?{id:'__group',x:(Math.min(...grouped.map(p=>p.x))+Math.max(...grouped.map(p=>p.x)))/2,z:(Math.min(...grouped.map(p=>p.z))+Math.max(...grouped.map(p=>p.z)))/2}:null;
  const minX=Math.min(-38,...sites.map(s=>s.x-9)),maxX=Math.max(40,...sites.map(s=>s.x+9));
  const width=maxX-minX,centre=(minX+maxX)/2;
  const roadRows=Math.max(2,...placements.filter(p=>p.vehicle.status==='in_transit').map(p=>Math.round((-p.z-12)/2.4)+1));
  const highwayZ=-12-(roadRows-1)*1.2, highwayDepth=roadRows*2.4+1.2;
  const frontZ=props.journey?10:layout.roadZ;
  const roads=props.journey?[10]:layout.roads;
  const lastRoad=roads[roads.length-1];
  const compact=props.roadLayout==='multiple' && !props.journey;
  const streetMin=compact?Math.min(-35,...sites.map(s=>s.x-10)):minX;
  const streetMax=compact?Math.max(-16,...sites.map(s=>s.x+10)):maxX;
  const streetCentre=(streetMin+streetMax)/2;
  const furniture=compact?streetFurniture(roads,streetMin,streetMax,sites,placements):null;
  const {gl}=useThree();const onFailure=props.onFailure;
  useEffect(()=>{const canvas=gl.domElement;const lost=(e:Event)=>{e.preventDefault();onFailure();};canvas.addEventListener('webglcontextlost',lost);return()=>canvas.removeEventListener('webglcontextlost',lost);},[gl,onFailure]);
  return <>
    <color attach="background" args={['#f3f6fa']}/><ambientLight intensity={.6}/><hemisphereLight args={['#ffffff','#cbd3df',.6]}/>
    <directionalLight position={[-25,50,20]} intensity={2} castShadow shadow-mapSize={props.fleet.length>250?[1024,1024]:[2048,2048]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-bias={-.0005}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.3,0]} receiveShadow><planeGeometry args={[2000,2000]}/><meshBasicMaterial color="#f3f6fa" toneMapped={false}/></mesh>
    {roads.map(z=><Road key={z} x={streetCentre} z={z} width={streetMax-streetMin}/>)}
    {roads.length>1 && [streetMin,streetMax].map(x=><group key={x} position={[x,0,(frontZ+lastRoad)/2]} rotation={[0,Math.PI/2,0]}><Road z={0} width={lastRoad-frontZ+5}/></group>)}
    <Road x={centre} y={HIGHWAY_HEIGHT} moving paused={props.paused} z={highwayZ} width={width} depth={highwayDepth}/>
    {Array.from({length:Math.ceil(width/12)},(_,i)=><group key={`pier-${i}`}>{[-1,1].map(side=><mesh key={side} position={[minX+6+i*12,HIGHWAY_HEIGHT/2-.15,highwayZ+side*highwayDepth*.3]} castShadow><boxGeometry args={[.8,HIGHWAY_HEIGHT,.8]}/><meshStandardMaterial color="#bbc3ce"/></mesh>)}</group>)}
    {compact && streetMax<maxX && <Road x={(streetMax+maxX)/2} z={frontZ} width={maxX-streetMax}/>}
    {furniture?.junctions.map(j=><StreetIntersection key={`${j.x}:${j.z}`} junction={j}/>)}
    {furniture?.trees.map(t=><Tree key={`verge-${t.x}:${t.z}`} x={t.x} z={t.z}/>)}
    <HighwayRamp x={maxX} frontZ={frontZ} highwayZ={-12} highwayDepth={5}/>
    {visibleSites.map((site,i)=><group key={site.id}>
      <mesh position={[site.x,-.06,site.z+site.direction*(Math.abs(site.roadZ-site.z)-3)/2]} receiveShadow><boxGeometry args={[13,.12,Math.abs(site.roadZ-site.z)-3]}/><meshStandardMaterial color="#c7cdd6"/></mesh>
      <group position={[site.x,0,site.z]} rotation={[0,site.direction===-1?Math.PI:0,0]}>{resolveLocationMeshType(site.icon)==='warehouse'?<Depot onSelect={()=>{if(!props.journey)props.onLocation(site.id);}}/>:<group scale={1.35}><LocationMesh x={0} z={0} location={{locationId:site.id,index:i,category:'depot',meshType:resolveLocationMeshType(site.icon),status:'active',changedAt:0,label:site.name}} showLocationLabels={false} onSelectLocation={props.onLocation}/></group>}</group>
      {props.showLabels && <Html position={[site.x,7,site.z-site.direction*3]} center zIndexRange={[8,0]}><button className="mv-location-label" aria-label={`View ${site.name}`} onClick={()=>{if(!props.journey)props.onLocation(site.id);}}><Building2 size={20}/><span><strong>{site.name}</strong><small>{site.address || 'Saved location'}</small>{!props.journey && <span className="mv-location-count">{site.vehicles.filter(v=>props.visibleIds.has(v.id)).length} vehicles <span className={site.vehicles.some(v=>waiting(v,props.now).overdue)?'mv-danger':''}><Clock3 size={13}/> {site.vehicles.filter(v=>props.visibleIds.has(v.id)&&waiting(v,props.now).overdue).length} overdue</span></span>}</span></button></Html>}
      <Tree x={site.x-6.5} z={site.z-site.direction*2}/><Tree x={site.x+6} z={site.z+site.direction}/><Lamp x={site.x+6.7} z={site.roadZ-site.direction*3.5}/>
    </group>)}
    {(['standby','unknown'] as const).map(group=>{const parked=visible.filter(p=>p.vehicle.status===group);if(!parked.length)return null;const x=parked[0].x+10;const minZ=Math.min(...parked.map(p=>p.z));const depth=Math.max(...parked.map(p=>p.z))-minZ+5;const Icon=group==='standby'?ParkingCircle:CircleHelp;return <group key={group}>
      {props.group==='standby' && group==='standby' && <group position={[x,0,minZ-7]}><Depot onSelect={()=>props.onGroup('standby')}/></group>}
      <mesh position={[x,-.07,minZ+depth/2-2]} receiveShadow><boxGeometry args={[29,.12,depth]}/><meshStandardMaterial color={group==='standby'?'#c7cdd6':'#e0e4ea'}/></mesh>
      <Html position={[x,3,minZ-1]} center zIndexRange={[7,0]}><button className="mv-area-label" onClick={()=>props.onGroup(group)}><Icon size={18}/>{group==='standby'?'Standby':'Unknown location'} <strong>{parked.length}</strong></button></Html>
      {parked.map(p=><mesh key={p.vehicle.id} position={[p.x+1.4,.01,p.z]}><boxGeometry args={[.045,.02,2.6]}/><meshBasicMaterial color="white"/></mesh>)}
    </group>;})}
    {!compact && Array.from({length:8},(_,i)=><Tree key={i} x={-35+i*11} z={frontZ*2+8+(i%2)*3}/>)}
    <FleetMeshes placements={visible} {...props}/>
    {props.journey && <group><mesh position={[0,.04,10]}><boxGeometry args={[38,.04,.13]}/><meshBasicMaterial color="#1463ff" toneMapped={false}/></mesh>{[-19,19].map(x=><mesh key={x} position={[x,.04,5.7]}><boxGeometry args={[.13,.04,8.6]}/><meshBasicMaterial color="#1463ff" toneMapped={false}/></mesh>)}</group>}
    <Camera compact={compact} centreX={compact?streetCentre:0} interactionMode={props.interactionMode} roadZ={(frontZ+lastRoad)/2} extent={Math.max(80,(lastRoad-frontZ)*1.5)} paused={props.paused} camera={props.camera} zoom={props.zoom} focus={props.focus} selected={props.journey||props.location||props.group?null:props.selected} location={groupSite?'__group':props.location} placements={placements} sites={groupSite?[...sites,groupSite]:sites}/>
  </>;
}
class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {state={failed:false};static getDerivedStateFromError(){return {failed:true};}componentDidCatch(){this.props.onFailure();}render(){return this.state.failed?<div className="mv-empty">3D is unavailable. Use the fleet list to continue.</div>:this.props.children;}}
export default function MonitorScene(props:SceneProps) {return <SceneBoundary onFailure={props.onFailure}><Canvas shadows dpr={[1,1.5]} camera={{position:[35,42,55],fov:38,near:.1,far:2500}} gl={{antialias:true,powerPreference:'high-performance'}}><World {...props}/></Canvas></SceneBoundary>;}
