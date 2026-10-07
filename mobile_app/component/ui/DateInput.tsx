import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDateOnly, parseDateOnly } from '@/src/lib/date-only';
import { Text } from './Text';
import type { DateInputProps } from './DateInput.types';

export function DateInput({ value, onChange, disabled = false, label = 'Expiry date' }: DateInputProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const openPicker = () => {
    Keyboard.dismiss();
    const initial = parseDateOnly(value) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        display: 'default',
        onValueChange: (_, selectedDate) => onChange(formatDateOnly(selectedDate)),
      });
    } else {
      setDraft(initial);
      setOpen(true);
    }
  };

  return (
    <View className="mt-4">
      <Pressable disabled={disabled} onPress={openPicker} accessibilityRole="button"
        accessibilityLabel={`${label}, ${value || 'not selected'}`}
        accessibilityHint="Open the date picker"
        accessibilityState={{ disabled, expanded: open }}
        className="border-input-border bg-input flex-row items-center justify-between rounded-[9px] border px-4 py-4"
        style={{ minHeight: 56, opacity: disabled ? 0.5 : 1 }}>
        <Text className={value ? 'text-input-foreground text-base' : 'text-muted-foreground text-base'}>{value || 'YYYY-MM-DD'}</Text>
        <Feather name="calendar" size={20} color={dark ? '#A1A1AA' : '#71717A'} />
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <View className="border-input-border bg-input mt-3 rounded-[9px] border p-2">
          <DateTimePicker value={draft} mode="date" display="inline" themeVariant={dark ? 'dark' : 'light'}
            onValueChange={(_, date) => setDraft(date)} />
          <View className="flex-row justify-between">
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" className="px-4 py-3">
              <Text className="text-muted-foreground text-base">Cancel</Text>
            </Pressable>
            <Pressable disabled={disabled} onPress={() => { onChange(formatDateOnly(draft)); setOpen(false); }} accessibilityRole="button" className="px-4 py-3">
              <Text className="text-primary text-base font-semibold">Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
