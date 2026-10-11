import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { RunDetailContent } from '@/components/runs/run-detail-content';
import { ShipmentDetailContent } from '@/components/shipments/shipment-detail-content';
import { DriverDetailContent } from '@/components/drivers/driver-detail-content';

export default async function ConversationRecordPage({ params, searchParams }: {
    params: Promise<{ type: string; recordId: string }>;
    searchParams: Promise<{ merchant_id?: string }>;
}) {
    const { type, recordId } = await params;
    const session = await requireRole(['user', 'super_admin']);
    if (type === 'driver') {
        const { merchant_id } = await searchParams;
        // The driver API validates access to the requested conversation merchant.
        return <DriverDetailContent driverId={recordId} accessToken={session.accessToken} merchantId={merchant_id} embedded />;
    }
    if (type === 'run') return <RunDetailContent runId={recordId} embedded />;
    if (type === 'shipment') {
        // Let the API resolve the record's merchant against the user's access,
        // including references opened from the All merchants inbox.
        return <ShipmentDetailContent shipmentId={recordId} accessToken={session.accessToken} embedded />;
    }
    notFound();
}
