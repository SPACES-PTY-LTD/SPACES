import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TruckEvent } from "../types";

function formatEventType(value?: string) {
  if (!value) return null;
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function ActivitySummary({
  filteredLocationsCount,
  warehouseTypeCount,
  filteredTrucksCount,
  latest,
  history
}: {
  filteredLocationsCount: number;
  warehouseTypeCount: number;
  filteredTrucksCount: number;
  latest: TruckEvent | null;
  history: TruckEvent[];
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: 360,
        zIndex: 2147483647,
        pointerEvents: "auto",
        fontFamily: "ui-sans-serif, system-ui, -apple-system"
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(15, 23, 42, 0.12)",
          borderRadius: 14,
          padding: 14,
          boxShadow: "0 12px 35px rgba(15,23,42,0.10)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 className="font-bold">Activity</h3>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand activity summary" : "Collapse activity summary"}
            title={collapsed ? "Expand" : "Collapse"}
            style={{
              border: "1px solid rgba(15, 23, 42, 0.12)",
              background: "#fff",
              borderRadius: 8,
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              color: "#0f172a",
              cursor: "pointer"
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {collapsed ? null : (
          <>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
          New location IDs automatically add typed locations.
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a" }}>
          <div>Locations: {filteredLocationsCount}</div>
          <div>Warehouse-type: {warehouseTypeCount}</div>
          <div>Visible trucks: {filteredTrucksCount}</div>
        </div>

        <div style={{ height: 1, background: "rgba(15,23,42,0.12)", margin: "10px 0" }} />

        {latest ? (
          <div style={{ fontSize: 12, color: "#0f172a" }}>
            <div style={{ fontWeight: 700 }}>Latest event</div>
            <div style={{ marginTop: 4 }}>
              {formatEventType(latest.eventType) ?? latest.action} • {latest.truckId} • {latest.locationLabel ?? latest.locationId}
            </div>
            <div style={{ color: "#64748b", marginTop: 2 }}>
              Driver: {latest.driver}
              {latest.driverIntegrationId ? ` • ${latest.driverIntegrationId}` : ""}
            </div>
            {latest.driverEmail ? <div style={{ color: "#64748b", marginTop: 2 }}>{latest.driverEmail}</div> : null}
            {latest.driverTelephone ? <div style={{ color: "#64748b", marginTop: 2 }}>{latest.driverTelephone}</div> : null}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#64748b" }}>Waiting for events...</div>
        )}

        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 12, color: "#0f172a" }}>Recent events</div>
        <div style={{ marginTop: 8, position: "relative", paddingLeft: 18 }}>
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 2,
              bottom: 2,
              width: 2,
              background: "rgba(100,116,139,0.25)",
              borderRadius: 999
            }}
          />
          <div style={{ display: "grid", gap: 8 }}>
            {history.slice(0, 6).map((event) => (
              <div key={`${event.timestamp}-${event.truckId}-${event.action}`} style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -16,
                    top: 11,
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: event.action === "ARRIVE" ? "#16a34a" : "#f97316",
                    border: "2px solid #fff",
                    boxShadow: "0 0 0 1px rgba(15,23,42,0.12)"
                  }}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    fontSize: 11,
                    color: "#1e293b",
                    background: "#f8fafc",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 10,
                    padding: "7px 8px"
                  }}
                >
                  <div>
                    {(formatEventType(event.eventType) ?? event.action)} {event.truckId} @ {event.locationLabel ?? event.locationId}
                  </div>
                  <div style={{ color: "#64748b" }}>{new Date(event.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
