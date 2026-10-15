'use client';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { rampSection } from './highway';

export function HighwayRamp({ x, frontZ, highwayZ, highwayDepth }: { x:number; frontZ:number; highwayZ:number; highwayDepth:number }) {
  const geometries = useMemo(() => {
    const strip = (edge: number | null) => {
      const vertices:number[] = [], indices:number[] = [];
      for(let i=0;i<=96;i++) {
        const s=rampSection(i/96,frontZ,highwayZ,highwayDepth);
        const offsets=edge===null?[-s.width/2,s.width/2]:[edge*(s.width/2-.16)-.05,edge*(s.width/2-.16)+.05];
        for(const offset of offsets) vertices.push(s.x+s.radialX*offset,s.y+(edge===null?-.01:.025),s.z+s.radialZ*offset);
        if(i<96){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
      const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
    };
    return [strip(null),strip(-1),strip(1)];
  },[frontZ,highwayZ,highwayDepth]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  return <group position={[x,0,0]}>
    <mesh geometry={geometries[0]} receiveShadow><meshStandardMaterial color="#8d97a5" roughness={.95}/></mesh>
    {geometries.slice(1).map((geometry,i)=><mesh key={i} geometry={geometry}><meshBasicMaterial color="#f9fafb"/></mesh>)}
    {[.3,.55,.8].map(t=>{const s=rampSection(t,frontZ,highwayZ,highwayDepth);return <mesh key={t} position={[s.x,s.y/2-.15,s.z]} castShadow><boxGeometry args={[.8,s.y+.1,.8]}/><meshStandardMaterial color="#b4bdc9"/></mesh>;})}
  </group>;
}
