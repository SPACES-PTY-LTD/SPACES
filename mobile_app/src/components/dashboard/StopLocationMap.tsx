import { StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { NativeMap } from './NativeMap';

export type StopLocationMapProps = { coordinate: { latitude: number; longitude: number }; name: string; dark: boolean };

export function StopLocationMap({ coordinate, name, dark }: StopLocationMapProps) {
  return <NativeMap dark={dark} style={StyleSheet.absoluteFill}
    region={{ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
    scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
    showsCompass={false} showsPointsOfInterests={false} toolbarEnabled={false}
    accessibilityLabel={`Map showing ${name}`}>
    <Marker coordinate={coordinate} title={name} pinColor="#e43e3e" />
  </NativeMap>;
}
