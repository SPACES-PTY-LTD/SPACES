import type { MapStyleElement } from 'react-native-maps';

/** Neutral basemap; route and vehicle overlays retain their own colours. */
export const runMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#ededed' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d0d0d0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#dedede' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d8d8d8' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c7c7c7' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#707070' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9cdd0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#73777a' }] },
];
