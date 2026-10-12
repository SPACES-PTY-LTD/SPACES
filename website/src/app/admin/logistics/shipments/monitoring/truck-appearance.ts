type TruckColourState = {
  isSpeeding?: boolean;
  isWaitingOverdue?: boolean;
  speedKph?: number | null;
  speedLimitKph?: number | null;
};

export function getTruckBodyColour(truck: TruckColourState, isSelected: boolean, isHovered: boolean) {
  const isSpeeding = truck.isSpeeding ?? (
    truck.speedKph !== null && truck.speedKph !== undefined &&
    truck.speedLimitKph !== null && truck.speedLimitKph !== undefined &&
    truck.speedKph > truck.speedLimitKph
  );
  const isAlert = isSpeeding || (truck.isWaitingOverdue ?? false);
  return isAlert ? (isHovered ? "#f87171" : "#ef4444") : isSelected ? "#2563eb" : isHovered ? "#9ca3af" : "#999999";
}
