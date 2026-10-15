'use client';
import { useEffect, useState } from 'react';

export function SceneLoading({ready,title,onFleetList}:{ready:boolean;title:string;onFleetList:()=>void}) {
  const [slow,setSlow]=useState(false);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    if(ready){const timer=setTimeout(()=>setHidden(true),220);return()=>clearTimeout(timer);}
    const timer=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(timer);
  },[ready]);
  if(hidden)return null;
  return <div className={`mv-scene-loading${ready?' is-ready':''}`} aria-hidden={ready || undefined}>
    <svg viewBox="0 0 360 170" aria-hidden="true" focusable="false">
      <path d="M20 128H340" stroke="#cbd4df" strokeWidth="32" strokeLinecap="round"/>
      <path d="M20 128H340" stroke="white" strokeWidth="2" strokeDasharray="14 12"/>
      {[55,205].map(x=><g key={x} transform={`translate(${x},20)`}>
        <path d="M0 25L48 5L100 25V82H0Z" fill="#e2e8f0"/>
        <path d="M0 25L48 5L100 25" fill="none" stroke="#bac6d4" strokeWidth="8" strokeLinejoin="round"/>
        {[16,57].map(door=><rect key={door} x={door} y="45" width="27" height="37" rx="2" fill="#8ca7bf"/>)}
      </g>)}
      <g className="mv-loading-truck">
        <rect x="0" y="108" width="43" height="23" rx="3" fill="#1463ff"/>
        <path d="M43 115H55L64 124V134H43Z" fill="#347aff"/>
        <path d="M47 118H54L59 124H47Z" fill="#dcecff"/>
        <circle cx="12" cy="135" r="6" fill="#344155"/><circle cx="53" cy="135" r="6" fill="#344155"/>
      </g>
    </svg>
    <div role="status" aria-live="polite" aria-atomic="true"><h2>{title}</h2><p>{slow?'Taking longer than expected. You can still browse the fleet list.':'You can browse the fleet list while we prepare the scene.'}</p></div>
    <button className="mv-control" onClick={onFleetList} tabIndex={ready?-1:0}>Fleet list</button>
  </div>;
}
