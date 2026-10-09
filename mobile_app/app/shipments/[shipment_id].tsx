import { useCallback, useState } from "react";
import {
    Stack,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from "expo-router";
import { ShipmentDetails } from "@/src/components/shipments/ShipmentDetails";

export default function ShipmentDetailScreen() {
    const { shipment_id, run_id } = useLocalSearchParams<{
        shipment_id: string;
        run_id?: string;
    }>();
    const router = useRouter();
    const [refreshKey, setRefreshKey] = useState(0);
    useFocusEffect(
        useCallback(() => {
            setRefreshKey((value) => value + 1);
        }, []),
    );
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <ShipmentDetails
                refreshKey={refreshKey}
                shipmentId={shipment_id}
                runId={run_id}
                onClose={() => router.back()}
            />
        </>
    );
}
