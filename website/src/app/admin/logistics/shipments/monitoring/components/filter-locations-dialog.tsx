import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { LOCATION_MESH_TYPE_OPTIONS } from "../constants";
import type { FilterableLocationMeshType } from "../types";

export function FilterLocationsDialog({
  isOpen,
  onOpenChange,
  visibleTypeSet,
  visibleLocationTypes,
  locationTypeCounts,
  toggleLocationType,
  showVehicleRegNumbers,
  onShowVehicleRegNumbersChange,
  showLocationLabels,
  onShowLocationLabelsChange
}: {
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  visibleTypeSet: Set<FilterableLocationMeshType>;
  visibleLocationTypes: FilterableLocationMeshType[];
  locationTypeCounts: Record<FilterableLocationMeshType, number>;
  toggleLocationType: (type: FilterableLocationMeshType) => void;
  showVehicleRegNumbers: boolean;
  onShowVehicleRegNumbersChange: (value: boolean) => void;
  showLocationLabels: boolean;
  onShowLocationLabelsChange: (value: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Options</Button>
      </DialogTrigger>
      <DialogContent className="z-50">
        <DialogHeader>
          <DialogTitle>Options</DialogTitle>
          <DialogDescription>Configure visibility for scene elements.</DialogDescription>
        </DialogHeader>

        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Display</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
              background: "#fff",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: 13, color: "#0f172a" }}>Vehicle reg numbers</span>
            <Switch checked={showVehicleRegNumbers} onCheckedChange={onShowVehicleRegNumbersChange} />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
              background: "#fff",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: 13, color: "#0f172a" }}>Location labels</span>
            <Switch checked={showLocationLabels} onCheckedChange={onShowLocationLabelsChange} />
          </label>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Location Types</div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {LOCATION_MESH_TYPE_OPTIONS.map((option) => {
            const checked = visibleTypeSet.has(option.value);
            const isLastSelected = checked && visibleLocationTypes.length === 1;
            return (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: checked ? "#eff6ff" : "#fff",
                  cursor: "pointer"
                }}
              >
                <span style={{ fontSize: 13, color: "#0f172a" }}>{option.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{locationTypeCounts[option.value]}</span>
                  <Switch checked={checked} disabled={isLastSelected} onCheckedChange={() => toggleLocationType(option.value)} />
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
