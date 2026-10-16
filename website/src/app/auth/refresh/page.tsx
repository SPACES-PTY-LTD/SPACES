"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { renewBrowserSession } from "@/lib/renew-session"

export default function RefreshSessionPage() {
  const [failed, setFailed] = useState(false)
  function finishRenewal(token: string | null) {
    if (!token) { setFailed(true); return }
    const path = new URLSearchParams(window.location.search).get("returnTo") ?? "/admin"
    window.location.replace(path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin?") ? path : "/admin")
  }
  useEffect(() => {
    let active = true
    void renewBrowserSession().then(token => { if (active) finishRenewal(token) })
    return () => { active = false }
  }, [])
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center" role="status">
    {failed ? <>
      <p>Unable to reconnect. Check your connection and try again.</p>
      <button className="underline" onClick={() => { setFailed(false); void renewBrowserSession().then(finishRenewal) }}>Try again</button>
    </> : <>
      <Loader2 className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </>}
  </div>
}
