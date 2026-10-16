"use client"

import { useEffect, useState } from "react"
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
  return <div className="space-y-4 p-6" role="status">
    <p>{failed ? "Unable to reconnect. Check your connection and try again." : "Restoring your session…"}</p>
    {failed && <button className="underline" onClick={() => { setFailed(false); void renewBrowserSession().then(finishRenewal) }}>Try again</button>}
  </div>
}
