import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

type MessageAction = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
};
type Message = { title: string; message: string; actions: MessageAction[] };
export type MessageSheetRef = {
  present: (title: string, message: string, actions?: MessageAction[]) => void;
};

/** Shared replacement for app-owned alerts; actions run after the sheet closes. */
export const MessageSheet = forwardRef<MessageSheetRef>(function MessageSheet(_, ref) {
  const modal = useRef<BottomSheetModal>(null);
  const selected = useRef<MessageAction | null>(null);
  const closing = useRef(false);
  const [content, setContent] = useState<Message>();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  useImperativeHandle(ref, () => ({
    present: (title, message, actions = [{ text: 'OK' }]) => {
      selected.current = null;
      closing.current = false;
      setContent({ title, message, actions });
    },
  }), []);
  useEffect(() => {
    if (!content) return;
    const frame = requestAnimationFrame(() => modal.current?.present());
    return () => cancelAnimationFrame(frame);
  }, [content]);
  return <BottomSheet modalRef={modal} title={content?.title} scrollable onDismiss={() => {
    const action = selected.current;
    selected.current = null;
    closing.current = false;
    setContent(undefined);
    if (action?.onPress) Promise.resolve().then(action.onPress).catch(error => {
      setContent({ title: 'Unable to complete action', message: error instanceof Error ? error.message : 'Please try again.', actions: [{ text: 'OK' }] });
    });
  }}>
    <Text selectable style={[styles.message, { color: dark ? '#d4d4d8' : '#52525b' }]}>{content?.message}</Text>
    {content?.actions.map((action, index) => <Pressable key={`${index}:${action.text}`} accessibilityRole="button" onPress={() => {
      if (closing.current) return;
      closing.current = true;
      selected.current = action;
      modal.current?.dismiss();
    }} style={[styles.action, { backgroundColor: action.style === 'destructive' ? '#dc2626' : dark ? '#27272a' : '#f4f4f5' }]}>
      <Text style={[styles.label, { color: action.style === 'destructive' || dark ? '#fff' : '#18181b' }]}>{action.text}</Text>
    </Pressable>)}
  </BottomSheet>;
});
const styles = StyleSheet.create({
  message: { fontSize: 15, lineHeight: 23 },
  action: { minHeight: 52, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
