import { View } from 'react-native';
import { Text } from '@/component/ui/Text';
import type { DriverDashboard } from '@/src/lib/api';

/** Existing run charges are read-only; absent/empty ledgers have no section. */
export function RunAdditionalCosts({ costs, ink, muted, line }: {
  costs: DriverDashboard['additional_costs']; ink: string; muted: string; line: string;
}) {
  if (!costs?.length) return null;
  return <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderColor: line, gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: ink, fontSize: 18, fontWeight: '700' }}>Additional costs</Text>
    {costs.map(cost => <View key={cost.cost_id} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
        <Text style={{ color: ink, fontSize: 14, flexGrow: 1, flexShrink: 1 }}>{cost.title}</Text>
        <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>{cost.currency === 'ZAR' ? 'R' : cost.currency} {cost.amount}</Text>
      </View>
      {!!cost.location_name && <Text style={{ color: muted, fontSize: 12 }}>{cost.location_name}</Text>}
    </View>)}
  </View>;
}
