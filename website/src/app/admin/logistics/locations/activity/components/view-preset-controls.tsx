import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { CameraPresetView } from "./activity-scene";

export function ViewPresetControls({
  onSelect,
  search,
  onSearchChange,
  onSearchSubmit,
  totalVehicles,
  searchResultsCount
}: {
  onSelect: (view: CameraPresetView) => void;
  search: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  totalVehicles: number;
  searchResultsCount: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* <Button variant="outline" onClick={() => onSelect("reset")}>Reset</Button> */}
      
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
        className="bg-white rounded-full flex items-center"
      >
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search reg number"
          className="h-9 w-[210px] bg-white rounded-full border-white!"
        />
        <Button type="submit" variant="outline" className="h-9 w-9 p-0 border-white rounded-full" aria-label="Search">
          <Search size={16} />
        </Button>
      </form>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          height: 36,
          borderRadius: 999,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(15,23,42,0.08)",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 700
        }}
      >
        <span>{totalVehicles} vehicles</span>
        {search.trim() ? <span style={{ color: "#475569" }}>{searchResultsCount} results</span> : null}
      </div>
      <Button variant="outline" onClick={() => onSelect("overview")}>Overview</Button>
      <Button variant="outline" onClick={() => onSelect("road")}>Road</Button>
      <Button variant="outline" onClick={() => onSelect("top")}>Top</Button>
      {/* <Button variant="outline" disabled={!hasSelectedTruck} onClick={() => onSelect("selected")}>Selected</Button> */}
    </div>
  );
}
