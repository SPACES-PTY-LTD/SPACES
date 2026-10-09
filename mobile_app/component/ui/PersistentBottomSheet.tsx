import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { type SharedValue, withTiming } from 'react-native-reanimated';
import { sheetTheme } from './sheet-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SNAP_POINTS = [0.25, 0.5, 0.92];

/** Persistent dashboard panel with native layout and a draggable resize handle. */
export function PersistentBottomSheet({ children, topInset = 0, containerHeight, animatedPosition }: PropsWithChildren<{ topInset?: number; containerHeight: number; animatedPosition?: SharedValue<number> }>) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [snapIndex, setSnapIndex] = useState(1);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const availableHeight = Math.max(0, containerHeight - topInset);
  const panelHeight = dragHeight ?? availableHeight * SNAP_POINTS[snapIndex];
  const nextIndex = (snapIndex + 1) % SNAP_POINTS.length;

  useEffect(() => {
    animatedPosition?.set(withTiming(containerHeight - panelHeight, { duration: dragHeight === null ? 200 : 0 }));
  }, [animatedPosition, containerHeight, panelHeight, dragHeight]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
    onPanResponderMove: (_, gesture) => {
      setDragHeight(Math.max(availableHeight * SNAP_POINTS[0], Math.min(availableHeight * SNAP_POINTS[2], availableHeight * SNAP_POINTS[snapIndex] - gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const target = availableHeight * SNAP_POINTS[snapIndex] - gesture.dy;
      const nearest = SNAP_POINTS.reduce((best, point, index) => Math.abs(availableHeight * point - target) < Math.abs(availableHeight * SNAP_POINTS[best] - target) ? index : best, 0);
      setSnapIndex(nearest);
      setDragHeight(null);
    },
    onPanResponderTerminate: () => setDragHeight(null),
  }), [availableHeight, snapIndex]);

  return <View style={[styles.sheet, { height: panelHeight, backgroundColor: dark ? sheetTheme.darkBackground : sheetTheme.background }]}>
    <View {...pan.panHandlers}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={`Resize dashboard to ${SNAP_POINTS[nextIndex] * 100}%`}
        accessibilityValue={{ text: `${SNAP_POINTS[snapIndex] * 100}%` }}
        accessibilityHint="Tap or drag to resize the dashboard"
        onPress={() => setSnapIndex(nextIndex)}
        style={{ height: 28, alignItems: 'center', paddingTop: 10 }}>
        <View style={{ width: sheetTheme.handleWidth, height: sheetTheme.handleHeight, borderRadius: 2, backgroundColor: dark ? '#71717a' : sheetTheme.handleColor }} />
      </Pressable>
    </View>
    {children}
  </View>;
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: sheetTheme.background,
    borderTopLeftRadius: sheetTheme.radius,
    borderTopRightRadius: sheetTheme.radius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
});
