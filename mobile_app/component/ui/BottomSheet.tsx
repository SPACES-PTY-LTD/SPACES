import { Feather } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetModal, BottomSheetFooter, type BottomSheetFooterProps, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { createContext, useContext, PropsWithChildren, RefObject, type ReactNode, useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, KeyboardAvoidingView, StyleSheet, useWindowDimensions, View, type ScrollViewProps } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Text } from './Text';
import { sheetTheme } from './sheet-theme';

export type BottomSheetProps = PropsWithChildren<{
  modalRef: RefObject<BottomSheetModal | null>;
  title?: string;
  /** Optional persistent action area above the detached sheet clearance. */
  footer?: ReactNode;
  onDismiss?: () => void;
  /** Leading navigation control; the caller owns returning to the previous step. */
  onBack?: () => void;
  accessibilityLabel?: string;
  scrollable?: boolean;
  /** Use native scrolling for location pickers without sheet pan gestures. */
  plainScroll?: boolean;
  /** Disable sheet content dragging when children own a reorder gesture. */
  contentPanning?: boolean;
  showsVerticalScrollIndicator?: boolean;
  onScroll?: ScrollViewProps['onScroll'];
  dismissible?: boolean;
  showCloseButton?: boolean;
  showHandle?: boolean;
  /** Gap after the header; defaults to the shared 16-point content gap. */
  headerBottomSpacing?: number;
  maxDynamicContentSize?: number;
  /** Keep an underlying modal visible with push; default switch preserves existing callers. */
  stackBehavior?: 'push' | 'switch' | 'replace';
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
}>;

const SheetDismissibleContext = createContext(true);
function SheetBackdrop(props: BottomSheetBackdropProps) {
  const dismissible = useContext(SheetDismissibleContext);
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior={dismissible ? 'close' : 'none'} />;
}

function ModalContainer({ children }: PropsWithChildren) {
  return Platform.OS === 'ios' ? <FullWindowOverlay>{children}</FullWindowOverlay> : <>{children}</>;
}

/** Shared floating sheet appearance, safe-area spacing, keyboard and dismissal behavior. */
export function BottomSheet({ modalRef, title, children, footer, onDismiss, accessibilityLabel,
  onBack, onScroll, showsVerticalScrollIndicator = true, plainScroll = false, contentPanning = true, scrollable = false, dismissible = true, showCloseButton = true, showHandle = true,
  maxDynamicContentSize, headerBottomSpacing = 16, keyboardBehavior = 'interactive', stackBehavior = 'switch' }: BottomSheetProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Keep a visible gap above Android's gesture/three-button navigation area.
  const bottomInset = Platform.OS === 'android' ? insets.bottom + 16 : Math.max(insets.bottom, 12);
  const maximumHeight = Math.min(maxDynamicContentSize ?? height * 0.88, height - insets.top - (Platform.OS === 'android' ? bottomInset + 12 : insets.bottom + 24));
  const background = dark ? sheetTheme.darkBackground : sheetTheme.background;
  const ink = dark ? '#fafafa' : '#18181b';
  const backSubscription = useCallback(() => {
    if (dismissible) modalRef.current?.dismiss();
    return true;
  }, [dismissible, modalRef]);
  // Register only while presented so hidden reusable sheets never swallow Android Back.
  const [visible, setVisible] = useState(false);
  const [dismissalCount, setDismissalCount] = useState(0);
  // Gorhom calls onDismiss while removing its portal. Notify consumers after
  // that React commit, when the iOS FullWindowOverlay has detached as well.
  useEffect(() => {
    if (dismissalCount > 0) onDismiss?.();
    // Callback identity changes must not replay a completed dismissal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissalCount]);
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', backSubscription);
    return () => subscription.remove();
  }, [visible, backSubscription]);
  const renderFooter = useCallback((props: BottomSheetFooterProps) => <BottomSheetFooter {...props}>
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, backgroundColor: background, borderBottomLeftRadius: sheetTheme.radius, borderBottomRightRadius: sheetTheme.radius }}>{footer}</View>
  </BottomSheetFooter>, [footer, background]);
  const header = <View style={[styles.header, { marginBottom: headerBottomSpacing - 16 }]}>
      {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: !dismissible }} disabled={!dismissible} onPress={onBack} style={[styles.back, { backgroundColor: dark ? '#303036' : '#f4f4f5', opacity: dismissible ? 1 : 0.4 }]}><Feather name="arrow-left" size={22} color={ink} /></Pressable>}
      {!!title && <Text style={[styles.title, { color: ink }]} accessibilityRole="header">{title}</Text>}
      {showCloseButton && <Pressable accessibilityRole="button" accessibilityLabel={`Close ${accessibilityLabel || title || 'sheet'}`} accessibilityState={{ disabled: !dismissible }} disabled={!dismissible} onPress={() => modalRef.current?.dismiss()} style={[styles.close, { backgroundColor: dark ? '#303036' : '#f4f4f5', opacity: dismissible ? 1 : 0.4 }]}><Feather name="x" size={22} color={ink} /></Pressable>}
    </View>;
  return <SheetDismissibleContext.Provider value={dismissible}><BottomSheetModal
    footerComponent={footer ? renderFooter : undefined}
    ref={modalRef} stackBehavior={stackBehavior} accessible={false} containerComponent={ModalContainer} index={0} enableDynamicSizing={!plainScroll}
    snapPoints={plainScroll ? [maximumHeight] : undefined}
    enableContentPanningGesture={!plainScroll && contentPanning}
    maxDynamicContentSize={maximumHeight} topInset={keyboardBehavior === 'fillParent' ? insets.top + 12 : 0} detached bottomInset={bottomInset}
    style={styles.sheet} backgroundStyle={{ backgroundColor: background, borderRadius: sheetTheme.radius }}
    handleComponent={showHandle ? undefined : null} handleIndicatorStyle={{ backgroundColor: dark ? '#71717a' : sheetTheme.handleColor, width: sheetTheme.handleWidth, height: sheetTheme.handleHeight }}
    enablePanDownToClose={dismissible} enableBlurKeyboardOnGesture keyboardBehavior={keyboardBehavior}
    keyboardBlurBehavior="restore" android_keyboardInputMode="adjustResize"
    onChange={index => setVisible(index >= 0)}
    onDismiss={() => { setVisible(false); setDismissalCount(count => count + 1); }}
    backdropComponent={SheetBackdrop}>
    {plainScroll ? <KeyboardAvoidingView style={styles.plainContent} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={showsVerticalScrollIndicator} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content} accessibilityViewIsModal accessibilityLabel={accessibilityLabel || title}>{header}{children}</ScrollView>
    </KeyboardAvoidingView> : scrollable ? <BottomSheetScrollView showsVerticalScrollIndicator={showsVerticalScrollIndicator} enableFooterMarginAdjustment={!!footer} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} accessibilityViewIsModal accessibilityLabel={accessibilityLabel || title}>{header}{children}</BottomSheetScrollView>
      : <BottomSheetView style={styles.content} accessibilityViewIsModal accessibilityLabel={accessibilityLabel || title}>{header}{children}</BottomSheetView>}

  </BottomSheetModal></SheetDismissibleContext.Provider>;
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  plainContent: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, lineHeight: 28, fontWeight: '700', flex: 1 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
});
