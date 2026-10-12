"use client"

// Local fixture verification only; never mounted by production admin pages.
import { useEffect, useState } from "react"
import { AdminRunActions } from "@/components/runs/admin-run-actions"
import { MessagesInbox } from "@/components/messages/messages-inbox"
import { StatusBadge } from "@/components/common/status-badge"
import type { Run, Location } from "@/lib/types"

const runId = "83b1d5ea-b0a9-466c-9619-41555b03a45f"
const depot = { location_id: "11111111-1111-4111-8111-111111111111", name: "Engen Isando", full_address: "1 Depot Road, Isando", latitude: -26, longitude: 28 } as Location
const mine = { location_id: "22222222-2222-4222-8222-222222222222", name: "Tharisa Mine", full_address: "Mine access road, Rustenburg", latitude: -25, longitude: 27 } as Location
const initialRun = { run_id: runId, merchant_id: "merchant", environment_id: null, status: "in_progress", planned_origin: depot, planned_destination: mine, driver: { driver_id: "driver", name: "Alex Mokoena" }, can_edit_endpoints: true, can_update_delivery_order: true, can_message_driver: true } as Run

export default function AdminRunActionsPreview() {
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)
  const [view, setView] = useState("actions")
  useEffect(() => {
    const original = window.fetch
    const run = structuredClone(initialRun)
    let rows = [{ shipment_id: "a", reference: "DN-1042", destination: "Tharisa Mine" }, { shipment_id: "b", reference: "DN-1043", destination: "Brits Warehouse" }, { shipment_id: "c", reference: "DN-1044", destination: "Long delivery destination name for wrapping verification" }]
    const chat = { conversation_id: "chat", merchant_id: "merchant", type: "driver", driver_id: "driver", driver: { name: "Alex Mokoena", profile_photo_url: null }, title: "Alex Mokoena", status: "active", can_manage: true, members: [], latest_message: null }
    const messages: unknown[] = []
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin)
      const path = url.pathname
      const method = init?.method ?? "GET"
      const envelope = (data: unknown, meta = {}) => new Response(JSON.stringify({ success: true, data, meta }), { headers: { "Content-Type": "application/json" } })
      if (path.endsWith(`/runs/${runId}/delivery-order`)) {
        if (method === "PATCH") { const body = JSON.parse(String(init?.body)); rows = body.shipment_ids.map((id: string) => rows.find(row => row.shipment_id === id)); return envelope({ shipment_ids: body.shipment_ids }) }
        return envelope({ shipments: rows })
      }
      if (path.endsWith(`/runs/${runId}/endpoints`)) { const body = JSON.parse(String(init?.body)); run.planned_origin = [depot, mine].find(l => l.location_id === body.origin_location_id); run.planned_destination = [depot, mine].find(l => l.location_id === body.destination_location_id); return envelope(body) }
      if (path.endsWith(`/runs/${runId}`)) return envelope(run)
      if (path.endsWith("/locations")) return envelope([depot, mine], { current_page: 1, last_page: 1 })
      if (path.endsWith("/conversations/driver") || path.endsWith("/conversations/chat")) return envelope(chat)
      if (path.endsWith("/conversations/chat/messages")) {
        if (method === "POST") {
          const form = init?.body as FormData
          const message = { message_id: `message-${messages.length}`, user_id: "staff", sender_name: "Dispatch", body: form.get("body"), created_at: new Date().toISOString(), attachments: form.get("references[0][id]") ? [{ attachment_id: "ref", reference: { id: runId, type: "run", label: "Run 42", subtitle: "in progress" } }] : [] }
          messages.push(message); return envelope(message)
        }
        return envelope(messages)
      }
      if (path.endsWith("/conversations/chat/read")) return envelope({})
      if (path.endsWith("/conversations")) return envelope([chat], { last_page: 1 })
      return envelope([])
    }
    const timer = window.setTimeout(() => {
      setView(new URL(window.location.href).searchParams.get("view") ?? "actions")
      setReady(true)
    }, 0)
    return () => { window.clearTimeout(timer); window.fetch = original }
  }, [])
  if (!ready) return <p>Preparing fixture…</p>
  return <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
    <div className="mb-6 flex items-center gap-4"><span>Local verification fixture</span><button className="rounded border px-3 py-2" onClick={() => { document.documentElement.classList.toggle("dark", !dark); setDark(!dark) }}>Toggle theme</button></div>
    {view === "messages" ? <MessagesInbox token="fixture" userId="staff" merchants={[{ id: "merchant", name: "Fixture merchant", canManage: true }]} initialMerchant="merchant" initialRunId={runId} initialHandoff="fixture" /> : <>
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Run {runId}</h1><p className="text-sm text-muted-foreground">Engen Isando → Tharisa Mine</p></div><div className="flex items-center gap-2"><StatusBadge status="in_progress" /><AdminRunActions run={initialRun} token="fixture" /></div></header>
      <div className="mt-8 rounded-lg border p-6">Run detail content remains below the header.</div>
      <a className="mt-6 inline-block underline" href="?view=messages">Verify driver chat handoff</a>
    </>}
  </main>
}
