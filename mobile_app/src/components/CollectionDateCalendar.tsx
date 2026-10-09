import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { formatDateOnly, parseDateOnly } from '@/src/lib/date-only';
import { ImportButton } from './document-import-ui';

/** Sheet content; selection stays local until Use date is pressed. */
export function CollectionDateCalendar({ value, onConfirm }: { value: string; onConfirm: (value: string) => void }) {
  const [selected, setSelected] = useState(() => parseDateOnly(value) || new Date());
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  const offset = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const move = (delta: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  const navigation = (label: string, icon: 'chevron-left' | 'chevron-right' | 'chevrons-left' | 'chevrons-right', delta: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => move(delta)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={18} color="#555" />
    </Pressable>
  );
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {navigation('Previous year', 'chevrons-left', -12)}
      {navigation('Previous month', 'chevron-left', -1)}
      <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111' }}>{month.toLocaleDateString('en', { month: 'short', year: 'numeric' })}</Text>
      {navigation('Next month', 'chevron-right', 1)}
      {navigation('Next year', 'chevrons-right', 12)}
    </View>
    <View style={{ flexDirection: 'row' }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={{ width: '14.285714%', textAlign: 'center', fontSize: 12, color: '#666' }}>{day}</Text>)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
        const day = index - offset + 1;
        if (day < 1 || day > days) return <View key={index} style={{ width: '14.285714%', minHeight: 44 }} />;
        const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
        const active = formatDateOnly(date) === formatDateOnly(selected);
        return <Pressable key={index} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} accessibilityState={{ selected: active }} onPress={() => setSelected(date)} style={{ width: '14.285714%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: active ? '#15803d' : 'transparent' }}>
          <Text style={{ fontSize: 14, color: active ? '#fff' : '#111', fontWeight: active ? '600' : '400' }}>{day}</Text>
        </Pressable>;
      })}
    </View>
    <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, textAlign: 'center', color: '#555' }}>Selected: {formatDateOnly(selected)}</Text>
    <ImportButton label="Use date" onPress={() => onConfirm(formatDateOnly(selected))} />
  </View>;
}
