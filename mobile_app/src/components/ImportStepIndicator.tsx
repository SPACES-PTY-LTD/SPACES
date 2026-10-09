import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { canReturnToImportStep, importStepLabels, type ImportStep } from './import-steps';

export function ImportStepIndicator({ step, onBack, locked = false }: {
  step: ImportStep; onBack?: (step: ImportStep) => void; locked?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return <View style={styles.container}>
    <View style={styles.steps}>
      {importStepLabels.map((label, index) => {
        const target = (index + 1) as ImportStep;
        const enabled = !!onBack && canReturnToImportStep(step, target, locked);
        return <Pressable key={label} accessible accessibilityRole={enabled ? 'button' : 'text'}
          accessibilityLabel={`Step ${target} of 5, ${label}${target === step ? ', current step' : target < step ? ', completed' : ', upcoming'}`}
          accessibilityHint={enabled ? `Return to ${label.toLowerCase()}` : undefined}
          accessibilityState={{ disabled: !enabled, selected: target === step }} disabled={!enabled}
          onPress={() => { if (enabled) onBack?.(target); }} style={styles.target}>
          <View style={[styles.segment, { backgroundColor: target <= step ? '#15803d' : dark ? '#3f3f46' : '#e4e4e7' }]} />
        </Pressable>;
      })}
    </View>
    <Text style={[styles.label, { color: dark ? '#a1a1aa' : '#71717a' }]}>STEP {step} OF 5 · {importStepLabels[step - 1].toUpperCase()}</Text>
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 0 }, steps: { flexDirection: 'row', gap: 6 },
  target: { flex: 1, minHeight: 44, justifyContent: 'center' }, segment: { height: 4, borderRadius: 2 },
  label: { fontSize: 11, lineHeight: 18, fontWeight: '700', letterSpacing: 0.8 },
});
