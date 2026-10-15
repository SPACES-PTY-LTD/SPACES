'use client';
import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { MonitorWorkspace } from './workspace';
import { useMonitorData } from './use-monitor-data';
function MerchantMonitor({token,merchant}:{token:string;merchant:string}){const data=useMonitorData(token,merchant);return <MonitorWorkspace {...data} token={token} merchant={merchant}/>;}
export default function MonitoringV2Page(){
  const {data:session,status}=useSession();
  const merchant=session?.selected_merchant?.merchant_id;
  if(status==='loading')return <div className="p-8">Loading monitoring…</div>;
  if(!session?.accessToken || !merchant)return <div className="p-8">Select a merchant to open 3D Monitor V2.</div>;
  return <Suspense fallback={<div className="p-8">Loading monitoring…</div>}><MerchantMonitor key={merchant+session.accessToken} token={session.accessToken} merchant={merchant}/></Suspense>;
}
