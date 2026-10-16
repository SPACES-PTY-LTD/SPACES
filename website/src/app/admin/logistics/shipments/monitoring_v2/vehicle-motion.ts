import type { Placement, SitePlacement } from './model';

type Point = {x:number;y:number;z:number; jump?:boolean};
type Site = Pick<SitePlacement,'x'|'z'|'roadZ'|'direction'>;
type Motion = {position:Point;rotation:number;location:string|null;site?:Site;target:Point;path:Point[];visible:boolean;departing:boolean};
const point=(p:Placement):Point=>({x:p.x,y:p.y??0,z:p.z});
const same=(a:Point,b:Point)=>a.x===b.x && a.y===b.y && a.z===b.z;
const entrance=(s:Site):Point=>({x:s.x+6,y:0,z:s.roadZ});
const aisle=(s:Site,p:Point):Point=>({x:s.x+6,y:0,z:p.z});

/** Schematic yard movements only: never interpolate across unrelated locations. */
export class VehicleMotion {
  private states=new Map<string,Motion>();
  isAnimating(id:string){const s=this.states.get(id);return !!s && (s.visible || s.departing) && s.path.length>0;}
  position(id:string){return this.states.get(id)?.position;}
  prune(ids:Set<string>){for(const id of this.states.keys())if(!ids.has(id))this.states.delete(id);}
  step(p:Placement,site:Site|undefined,visible:boolean,delta:number,paused:boolean,reduced:boolean){
    const target=point(p),location=site && p.vehicle.status==='at_location'?p.vehicle.locationId:null;
    let s=this.states.get(p.vehicle.id);
    if(!s){
      s={position:location && site?entrance(site):target,rotation:p.rotation,location,site,target,path:location && site?[aisle(site,target),target]:[],visible,departing:false};
      this.states.set(p.vehicle.id,s);
    }else if(s.location!==location){
      const departure=s.location && s.site?[aisle(s.site,s.position),entrance(s.site)]:[];
      const arrival=location && site?[{...entrance(site),jump:true},aisle(site,target),target]:[{...target,jump:true}];
      s.departing=departure.length>0 && s.visible;
      s.path=[...departure,...arrival];s.location=location;s.site=site;s.target=target;
    }else if(!same(s.target,target)){
      // Layout changes are not arrivals or departures.
      s.position=target;s.target=target;s.path=[];s.site=site;s.departing=false;
    }
    if(reduced){s.position=target;s.path=[];s.departing=false;}
    else if(!paused){
      let distance=Math.min(delta,.05)*5;
      while(s.path.length){
        const next=s.path[0];
        if(next.jump){s.position={x:next.x,y:next.y,z:next.z};s.path.shift();s.departing=false;continue;}
        const dx=next.x-s.position.x,dy=next.y-s.position.y,dz=next.z-s.position.z;
        const length=Math.hypot(dx,dy,dz);
        if(length>.001)s.rotation=Math.atan2(dz,-dx); // Truck cab faces local -X.
        if(length<=distance){s.position={x:next.x,y:next.y,z:next.z};s.path.shift();distance-=length;}
        else {const t=distance/length;s.position={x:s.position.x+dx*t,y:s.position.y+dy*t,z:s.position.z+dz*t};break;}
      }
    }
    if(!s.path.length){s.rotation=p.rotation;s.departing=false;}
    s.visible=visible;
    return {position:s.position,rotation:s.rotation,visible:visible||s.departing};
  }
}
