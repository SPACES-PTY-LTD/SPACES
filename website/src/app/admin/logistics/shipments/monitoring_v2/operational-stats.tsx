'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, FileWarning } from 'lucide-react';
import { conversationRequest } from '@/lib/api/conversations';
import { getMissingDocumentsReport } from '@/lib/api/reports';
import { isApiErrorResponse } from '@/lib/api/client';
import { AdminLinks } from '@/lib/routes/admin';

type Counts = { token: string; merchant: string; unread: number | null; missing: number | null };

export function OperationalStats({token,merchant,sample,revision}:{token?:string;merchant?:string;sample?:boolean;revision:number|null}) {
  const router=useRouter();
  const [counts,setCounts]=useState<Counts|null>(null);
  useEffect(()=>{
    if(sample || !token || !merchant)return;
    let live=true,running=false;
    const accessToken=token,merchantId=merchant;
    async function refresh(){
      if(!live || running || document.hidden)return;
      running=true;
      const [messages,documents]=await Promise.allSettled([
        conversationRequest<{unread_count:number}>(accessToken,`/unread?${new URLSearchParams({merchant_id:merchantId})}`),
        getMissingDocumentsReport({merchant_id:merchantId,per_page:1,page:1},accessToken),
      ]);
      if(live)setCounts(previous=>{
        const same=previous?.token===accessToken && previous.merchant===merchantId;
        return {token:accessToken,merchant:merchantId,
          unread:messages.status==='fulfilled'?messages.value.data.unread_count:same?previous.unread:null,
          missing:documents.status==='fulfilled' && !isApiErrorResponse(documents.value)?documents.value.meta?.total ?? null:same?previous.missing:null};
      });
      running=false;
    }
    void refresh();
    const timer=setInterval(()=>void refresh(),60000);
    window.addEventListener('messages-read',refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{live=false;clearInterval(timer);window.removeEventListener('messages-read',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[token,merchant,sample,revision]);
  const current=counts?.token===token && counts?.merchant===merchant?counts:null;
  // Preview values are illustrative, never substituted for unavailable live data.
  const unread=sample?8:current?.unread;
  const missing=sample?12:current?.missing;
  return <>
    <button onClick={()=>router.push('/admin/messages')} title="Open messages"><MessageSquare className="mv-blue"/><span><strong>{unread ?? '—'}</strong><small>Unread Messages</small></span></button>
    <button onClick={()=>router.push(AdminLinks.analyticsMissingDocuments)} title="Missing required document uploads across drivers, vehicles and shipments"><FileWarning className="mv-danger"/><span><strong>{missing ?? '—'}</strong><small>Compliance</small><small className="mv-stat-description">Without documents uploaded</small></span></button>
  </>;
}
