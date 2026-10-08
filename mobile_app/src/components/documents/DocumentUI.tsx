import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DriverEntityFile } from '@/src/lib/api';

const icons = {
  file: require('@/assets/images/documents/file.svg'),
  back: require('@/assets/images/documents/back.svg'),
  chevron: require('@/assets/images/documents/chevron.svg'),
  required: require('@/assets/images/documents/required.svg'),
  requiredChevron: require('@/assets/images/documents/required-chevron.svg'),
  expired: require('@/assets/images/documents/expired.svg'),
};

export function DocumentIcon({ kind }: { kind: keyof typeof icons }) {
  const { colorScheme } = useColorScheme();
  const size = kind === 'chevron' || kind === 'requiredChevron' ? 20 : 24;
  const tintColor = colorScheme === 'dark'
    ? kind === 'required' || kind === 'requiredChevron' ? '#FDE68A' : kind === 'expired' ? '#FDA4AF' : '#A1A1AA'
    : undefined;
  return <Image source={icons[kind]} style={{ width: size, height: size }} tintColor={tintColor} />;
}

export function DocumentStatus({ file }: { file: DriverEntityFile }) {
  const { colorScheme } = useColorScheme();
  if (!file.is_expired) return null;
  const dark = colorScheme === 'dark';
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 14, backgroundColor: dark ? '#401E22' : '#FFE1E1' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: dark ? '#FDA4AF' : '#A32136' }}>Expired</Text>
    </View>
  );
}

export function formatDocumentDate(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDocumentSize(value?: number) {
  if (value == null || value < 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
