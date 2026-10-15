import { notFound } from 'next/navigation';
import MonitoringPreview from '../../../tests/fixtures/monitoring-v2-preview';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <MonitoringPreview/>;}
