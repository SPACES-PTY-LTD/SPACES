/** Only route known driver-message payloads; never follow arbitrary push URLs. */
export function driverMessageTarget(data: Record<string, unknown>) {
    if (
        data.kind !== 'driver_message' ||
        typeof data.conversation_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            data.conversation_id,
        )
    )
        return null;
    return {
        pathname: '/(tabs)/messages' as const,
        params: { conversation_id: data.conversation_id },
    };
}
