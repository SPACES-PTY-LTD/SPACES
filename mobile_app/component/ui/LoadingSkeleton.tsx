import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, View, type DimensionValue } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SkeletonKind = 'runs' | 'documents' | 'run-detail' | 'document-detail' | 'shipment-detail' | 'messages';

/** One pulse per loading section; respect Reduce Motion and stop work on dismissal. */
export function LoadingSkeleton({ kind, label }: { kind: SkeletonKind; label: string }) {
  const dark = useColorScheme().colorScheme === 'dark';
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduceMotion: boolean) => {
      if (!active) return;
      animation?.stop();
      opacity.setValue(1);
      if (!reduceMotion) {
        animation = Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: 0.45, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]));
        animation.start();
      }
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceChanged = true;
      update(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!preferenceChanged) update(value);
    }).catch(() => { /* Keep static placeholders if the preference cannot be read. */ });
    return () => { active = false; subscription.remove(); animation?.stop(); };
  }, [opacity]);

  const block = (width: DimensionValue, height: number, radius = 6) => (
    <View style={{ width, height, borderRadius: radius, backgroundColor: dark ? '#3f3f46' : '#e4e4e7' }} />
  );
  const card = (children: React.ReactNode, key: number) => (
    <View key={key} style={{ padding: 18, borderRadius: 20, gap: 14, backgroundColor: dark ? '#27272a' : '#f5f5f8' }}>{children}</View>
  );
  const rows = kind === 'documents' ? 4 : 3;
  const list = kind === 'runs' || kind === 'documents';
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={{ width: '100%' }}>
      <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity, gap: 16 }}>
        {kind === 'messages' ? Array.from({ length: 5 }, (_, index) => (
          <View key={index} style={{ width: index % 2 ? '72%' : '82%', alignSelf: index % 2 ? 'flex-end' : 'flex-start', padding: 16, borderRadius: 20, gap: 10, backgroundColor: dark ? (index % 2 ? '#153526' : '#27272a') : (index % 2 ? '#effcf4' : '#f5f5f8') }}>
            {block('45%', 10)}{block('95%', 14)}{block(index % 2 ? '60%' : '80%', 14)}
          </View>
        )) : list ? Array.from({ length: rows }, (_, index) => card(
          kind === 'documents' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {block(48, 48, 14)}<View style={{ flex: 1, gap: 10 }}>{block('75%', 16)}{block('55%', 12)}</View>
          </View> : <>{block('50%', 22)}{block('30%', 12)}{block('90%', 16)}{block('75%', 16)}{block('40%', 12)}</>, index,
        )) : <>
          {kind === 'shipment-detail' && block('100%', 180, 20)}
          {card(<>{kind === 'document-detail' && block(64, 64, 16)}{block('70%', 24)}{block('45%', 14)}{block('90%', 14)}{block('60%', 14)}</>, 0)}
          {card(<>{block('40%', 18)}{block('85%', 14)}{block('70%', 14)}{block('90%', 14)}</>, 1)}
          {kind === 'run-detail' && card(<>{block('55%', 18)}{block('80%', 16)}{block('65%', 12)}{block('80%', 16)}{block('65%', 12)}</>, 2)}
        </>}
      </Animated.View>
    </View>
  );
}
