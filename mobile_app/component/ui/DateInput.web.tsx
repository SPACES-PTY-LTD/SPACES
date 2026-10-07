import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DateInputProps } from './DateInput.types';

export function DateInput({ value, onChange, disabled = false, label = 'Expiry date' }: DateInputProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return <input type="date" aria-label={label} value={value} disabled={disabled}
    onChange={event => onChange(event.target.value)}
    style={{ boxSizing: 'border-box', width: '100%', marginTop: 16, minHeight: 56, padding: 16, fontSize: 16,
      borderRadius: 9, border: `1px solid ${dark ? '#27272A' : '#DADCD8'}`, background: dark ? '#18181B' : '#FFFFFF',
      color: dark ? '#FFFFFF' : '#18181B', colorScheme: dark ? 'dark' : 'light' }} />;
}
