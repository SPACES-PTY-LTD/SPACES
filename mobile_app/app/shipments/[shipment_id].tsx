import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ShipmentDetails } from "@/src/components/shipments/ShipmentDetails";

export default function ShipmentDetailScreen() {
    const { shipment_id, run_id } = useLocalSearchParams<{
        shipment_id: string;
        run_id?: string;
    }>();
    const router = useRouter();
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <ShipmentDetails
                shipmentId={shipment_id}
                runId={run_id}
                onClose={() => router.back()}
            />
        </>
    );
}
