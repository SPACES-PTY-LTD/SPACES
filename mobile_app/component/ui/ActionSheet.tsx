import { MessageSheet, type MessageSheetRef } from './MessageSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BottomSheet, type BottomSheetProps } from './BottomSheet';
import { Text } from './Text';

export type ActionSheetAction = {
  id: string;
  label: string;
  onPress: () => void | Promise<void>;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  selected?: boolean;
  accessibilityHint?: string;
};
export type ActionSheetConfig = {
  title?: string;
  actions: ActionSheetAction[];
  accessibilityLabel?: string;
  showCloseButton?: boolean;
  showHandle?: boolean;
  stackBehavior?: BottomSheetProps['stackBehavior'];
  onDismiss?: (actionId?: string) => void;
  onError?: (error: unknown) => void;
};
export type ActionSheetRef = { present: (config: ActionSheetConfig) => void; dismiss: () => void };

/** Actions run after dismissal so navigation and native pickers can safely open next. */
export const ActionSheet = forwardRef<ActionSheetRef>(function ActionSheet(_, ref) {
  const errorSheet = useRef<MessageSheetRef>(null);
  const modalRef = useRef<BottomSheetModal>(null);
  const selected = useRef<ActionSheetAction | null>(null);
  const running = useRef(false);
  const [config, setConfig] = useState<ActionSheetConfig | null>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  useImperativeHandle(ref, () => ({
    present: next => {
      if (running.current) return;
      selected.current = null;
      setConfig(next);
    },
    dismiss: () => modalRef.current?.dismiss(),
  }), []);
  // Present after the updated options have committed so dynamic sizing can
  // measure the populated sheet, including the first time it opens.
  useEffect(() => {
    if (!config) return;
    const frame = requestAnimationFrame(() => modalRef.current?.present());
    return () => cancelAnimationFrame(frame);
  }, [config]);
  return <><BottomSheet modalRef={modalRef} stackBehavior={config?.stackBehavior} title={config?.title} showCloseButton={config?.showCloseButton ?? false} showHandle={config?.showHandle ?? false} accessibilityLabel={config?.accessibilityLabel || 'Actions'} scrollable={(config?.actions.length || 0) > 5} onDismiss={() => {
    const action = selected.current;
    selected.current = null;
    const previous = config;
    setConfig(null);
    previous?.onDismiss?.(action?.id);
    if (!action) return;
    Promise.resolve().then(() => action.onPress()).catch(error => {
      if (previous?.onError) previous.onError(error);
      else errorSheet.current?.present('Unable to complete action', error instanceof Error ? error.message : 'Please try again.');
    }).finally(() => { running.current = false; });
  }}>
    {config?.actions.map(action => <TouchableOpacity key={action.id} disabled={action.disabled} accessibilityRole="button" accessibilityLabel={action.label} accessibilityHint={action.accessibilityHint} accessibilityState={{ disabled: Boolean(action.disabled), selected: action.selected }} onPress={() => {
      if (action.disabled || running.current) return;
      running.current = true;
      selected.current = action;
      modalRef.current?.dismiss();
    }} style={[styles.action, { backgroundColor: action.variant === 'destructive' ? '#dc2626' : dark ? '#18181b' : '#ffffff', borderWidth: 1, borderColor: action.variant === 'destructive' ? '#dc2626' : dark ? '#3f3f46' : '#e4e4e7', opacity: action.disabled ? 0.45 : 1 }]}>
      <Text style={[styles.label, { color: action.variant === 'destructive' || dark ? '#fff' : '#18181b' }]}>{action.selected ? `✓  ${action.label}` : action.label}</Text>
    </TouchableOpacity>)}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => modalRef.current?.dismiss()} style={styles.action}><Text style={[styles.label, { color: dark ? '#fff' : '#18181b' }]}>Cancel</Text></TouchableOpacity>
  </BottomSheet><MessageSheet ref={errorSheet} /></>;
});
const styles = StyleSheet.create({
  action: { minHeight: 52, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
