import { View } from 'react-native';
import { Text } from '@/component/ui/Text';
import type { StopLocationMapProps } from './StopLocationMap';

export function StopLocationMap({ name, dark }: StopLocationMapProps) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }}>
    <Text style={{ color: dark ? '#fafafa' : '#18181b', fontWeight: '600' }}>{name}</Text>
    <Text style={{ color: dark ? '#a1a1aa' : '#71717a', textAlign: 'center' }}>Open the mobile app to view this location on the map.</Text>
  </View>;
}
