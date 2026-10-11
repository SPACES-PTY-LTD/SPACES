import { View } from 'react-native';
import { Text } from '@/component/ui/Text';
import type { RunSafety } from '@/src/lib/api';

function speed(value: number | null) {
  return value !== null && Number.isFinite(value) ? `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} km/h` : 'Not available';
}

function eventTime(value: string | null, timezone: string) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return 'Not available';
  return date.toLocaleString('en-ZA', { timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Full-run telemetry remains independent of the selected timeline filter. */
export function RunSafetySection({ safety, timezone, ink, muted, line }: {
  safety?: RunSafety | null; timezone: string; ink: string; muted: string; line: string;
}) {
  return <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderColor: line, gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: ink, fontSize: 18, fontWeight: '700' }}>Safety and speeding</Text>
    {!safety ? <Text style={{ color: muted, fontSize: 13 }}>Safety data is not available for this run.</Text> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          ['Speeding events', String(safety.speeding_event_count)],
          ['Maximum speed', speed(safety.maximum_speed_kph)],
          ['Worst exceedance', speed(safety.worst_speed_exceedance_kph)],
        ].map(([label, value]) => <View key={label} accessible style={{ flexGrow: 1, flexBasis: 100, borderWidth: 1, borderColor: line, borderRadius: 12, padding: 12, gap: 8 }}>
          <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>{label}</Text>
          <Text style={{ color: ink, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
        </View>)}
      </View>
      {safety.speeding_events.length ? safety.speeding_events.map(event => <View key={event.activity_id} style={{ borderTopWidth: 1, borderColor: line, paddingTop: 12, gap: 8 }}>
        <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Time: {eventTime(event.occurred_at, timezone)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <Text style={{ color: ink, fontSize: 13 }}>Speed: {speed(event.speed_kph)}</Text>
          <Text style={{ color: ink, fontSize: 13 }}>Limit: {speed(event.speed_limit_kph)}</Text>
        </View>
        <Text style={{ color: muted, fontSize: 13 }}>Location: {event.latitude !== null && event.longitude !== null ? `${event.latitude}, ${event.longitude}` : 'Not available'}</Text>
      </View>) : <Text style={{ color: muted, fontSize: 13, lineHeight: 20 }}>No speeding events have been recorded for this run.</Text>}
    </>}
  </View>;
}
