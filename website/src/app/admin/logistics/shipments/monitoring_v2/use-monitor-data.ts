'use client';
import { useCallback, useEffect, useState } from 'react';
import { listAllVehiclesCheck, listVehicleActivities } from '@/lib/api/vehicle-activities';
import { isApiErrorResponse } from '@/lib/api/client';
import type { VehicleActivity } from '@/lib/types';
import { normalizeFleet } from './model';

export function useMonitorData(token?:string, merchant?:string) {
  const [state,setState]=useState<{rows:VehicleActivity[];events:VehicleActivity[];loading:boolean;error:string|null;eventError:string|null;updated:number|null}>({rows:[],events:[],loading:true,error:null,eventError:null,updated:null});
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{
    if(!token || !merchant) return;
    let disposed=false, inFlight=false;
    const controller=new AbortController();
    async function fetchSnapshot(){
      if(inFlight || document.hidden) return;
      inFlight=true;
      try {
        const [fleetResult,eventResult]=await Promise.allSettled([
          listAllVehiclesCheck(token,{merchant_id:merchant},controller.signal),
          listVehicleActivities(token,{merchant_id:merchant,per_page:50,page:1},controller.signal)
        ]);
        if(disposed) return;
        if(fleetResult.status==='rejected' || isApiErrorResponse(fleetResult.value)) {
          setState(s=>({...s,loading:false,error:s.updated?'Fleet refresh failed. Showing the last successful snapshot.':'Unable to load the fleet. Please retry.'})); return;
        }
        const events=eventResult.status==='fulfilled' && !isApiErrorResponse(eventResult.value)?eventResult.value.data:null;
        const rows=fleetResult.value.data ?? [];
        setState(s=>({rows,events:events ?? s.events,loading:false,error:null,eventError:events?null:'Recent events could not be refreshed.',updated:Date.now()}));
      } catch { if(!disposed) setState(s=>({...s,loading:false,error:'Unable to load monitoring data. Try refresh.'})); }
      finally{inFlight=false;}
    }
    void fetchSnapshot();
    const timer=setInterval(()=>void fetchSnapshot(),60000);
    const visible=()=>{if(!document.hidden) void fetchSnapshot();};
    document.addEventListener('visibilitychange',visible);
    return ()=>{disposed=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[token,merchant,revision]);
  return {...state,fleet:normalizeFleet(state.rows),refresh};
}
