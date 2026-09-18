import { Feather } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { createContext, useContext, PropsWithChildren, RefObject, useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Text } from './Text';
import { sheetTheme } from './sheet-theme';

export type BottomSheetProps = PropsWithChildren<{
  modalRef: RefObject<BottomSheetModal | null>;
  title?: string;
  onDismiss?: () => void;
  accessibilityLabel?: string;
  scrollable?: boolean;
  dismissible?: boolean;
  showCloseButton?: boolean;
  showHandle?: boolean;
  maxDynamicContentSize?: number;
}>;

const SheetDismissibleContext = createContext(true);
function SheetBackdrop(props: BottomSheetBackdropProps) {
  const dismissible = useContext(SheetDismissibleContext);
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior={dismissible ? 'close' : 'none'} />;
}

function ModalContainer({ children }: PropsWithChildren) {
  return Platform.OS === 'ios' ? <FullWindowOverlay><GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView></FullWindowOverlay> : <>{children}</>;
}

/** Shared floating sheet appearance, safe-area spacing, keyboard and dismissal behavior. */
export function BottomSheet({ modalRef, title, children, onDismiss, accessibilityLabel,
  scrollable = false, dismissible = true, showCloseButton = true, showHandle = true,
  maxDynamicContentSize }: BottomSheetProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maximumHeight = Math.min(maxDynamicContentSize ?? height * 0.88, height - insets.top - insets.bottom - 24);
  const background = dark ? sheetTheme.darkBackground : sheetTheme.background;
  const ink = dark ? '#fafafa' : '#18181b';
  const backSubscription = useCallback(() => {
    if (dismissible) modalRef.current?.dismiss();
    return true;
  }, [dismissible, modalRef]);
  // Register only while presented so hidden reusable sheets never swallow Android Back.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', backSubscription);
    return () => subscription.remove();
  }, [visible, backSubscription]);
  const content = <>
    <View style={styles.header}>
      {!!title && <Text style={[styles.title, { color: ink }]} accessibilityRole="header">{title}</Text>}
      {showCloseButton && <Pressable accessibilityRole="button" accessibilityLabel={`Close ${accessibilityLabel || title || 'sheet'}`} accessibilityState={{ disabled: !dismissible }} disabled={!dismissible} onPress={() => modalRef.current?.dismiss()} style={[styles.close, { backgroundColor: dark ? '#303036' : '#f4f4f5', opacity: dismissible ? 1 : 0.4 }]}><Feather name="x" size={22} color={ink} /></Pressable>}
    </View>
    {children}
  </>;
  return <SheetDismissibleContext.Provider value={dismissible}><BottomSheetModal
    ref={modalRef} accessible={false} containerComponent={ModalContainer} index={0} enableDynamicSizing
    maxDynamicContentSize={maximumHeight} detached bottomInset={Math.max(insets.bottom, 12)}
    style={styles.sheet} backgroundStyle={{ backgroundColor: background, borderRadius: sheetTheme.radius }}
    handleComponent={showHandle ? undefined : null} handleIndicatorStyle={{ backgroundColor: dark ? '#71717a' : sheetTheme.handleColor, width: sheetTheme.handleWidth, height: sheetTheme.handleHeight }}
    enablePanDownToClose={dismissible} enableBlurKeyboardOnGesture keyboardBehavior="interactive"
    keyboardBlurBehavior="restore" android_keyboardInputMode="adjustResize"
    onChange={index => setVisible(index >= 0)}
    onDismiss={() => { setVisible(false); onDismiss?.(); }}
    backdropComponent={SheetBackdrop}>
    {scrollable ? <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} accessibilityViewIsModal accessibilityLabel={accessibilityLabel || title}>{content}</BottomSheetScrollView>
      : <BottomSheetView style={styles.content} accessibilityViewIsModal accessibilityLabel={accessibilityLabel || title}>{content}</BottomSheetView>}
  </BottomSheetModal></SheetDismissibleContext.Provider>;
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', flex: 1 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
});
