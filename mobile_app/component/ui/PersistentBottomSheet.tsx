import Sheet from '@gorhom/bottom-sheet';
import { PropsWithChildren, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { sheetTheme } from './sheet-theme';

const SNAP_POINTS = ['25%', '50%', '92%'];

/** In-screen sheet: stays above the map and below tab navigation and upload modals. */
export function PersistentBottomSheet({ children, topInset = 0, animatedPosition }: PropsWithChildren<{ topInset?: number; animatedPosition?: SharedValue<number> }>) {
  const ref = useRef<Sheet>(null);
  const [snapIndex, setSnapIndex] = useState(1);
  const nextIndex = (snapIndex + 1) % SNAP_POINTS.length;
  const handle = useCallback(() => <Pressable accessibilityRole="button"
    accessibilityLabel={`Resize dashboard to ${SNAP_POINTS[nextIndex]}`}
    accessibilityValue={{ text: SNAP_POINTS[snapIndex] }}
    accessibilityHint="Tap or drag to resize the dashboard"
    onPress={() => ref.current?.snapToIndex(nextIndex)}
    style={{ height: 28, alignItems: 'center', paddingTop: 10 }}>
    <View style={{ width: sheetTheme.handleWidth, height: sheetTheme.handleHeight, borderRadius: 2, backgroundColor: sheetTheme.handleColor }} />
  </Pressable>, [nextIndex, snapIndex]);
  return <Sheet ref={ref} accessible={false} index={1} animatedPosition={animatedPosition} snapPoints={SNAP_POINTS} enableDynamicSizing={false}
    enablePanDownToClose={false} topInset={topInset} animateOnMount={false}
    onChange={index => setSnapIndex(index)} handleComponent={handle}
    style={styles.sheet}
    backgroundStyle={{ backgroundColor: sheetTheme.background, borderTopLeftRadius: sheetTheme.radius, borderTopRightRadius: sheetTheme.radius }}>
    {children}
  </Sheet>;
}

const styles = StyleSheet.create({
  sheet: {
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
