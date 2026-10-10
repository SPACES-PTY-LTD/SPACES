import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import type { ChatAttachment } from '@/src/lib/api';
import { photoPanOffset, photoSwipeDirection } from '@/src/lib/chat-images';
import { ChatImage } from './ChatImage';

type Props = { token: string; conversationId: string; images: ChatAttachment[]; initialId: string; onClose: () => void };

export function ChatPhotoViewer({ token, conversationId, images, initialId, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(() => Math.max(0, images.findIndex(image => image.attachment_id === initialId)));
    const [size, setSize] = useState({ width: 1, height: 1 });
    const scale = useSharedValue(1), savedScale = useSharedValue(1);
    const x = useSharedValue(0), y = useSharedValue(0);
    const blockSwipe = useSharedValue(false);
    const savedX = useSharedValue(0), savedY = useSharedValue(0);
    function reset() { scale.value = savedScale.value = 1; x.value = y.value = savedX.value = savedY.value = 0; }
    function move(direction: number) {
        const next = Math.max(0, Math.min(images.length - 1, index + direction));
        if (next !== index) { reset(); setIndex(next); }
    }
    const pinch = Gesture.Pinch().onStart(() => { blockSwipe.value = true; savedScale.value = scale.value; }).onUpdate(event => {
        scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
        x.value = photoPanOffset(x.value, size.width, scale.value);
        y.value = photoPanOffset(y.value, size.height, scale.value);
    }).onEnd(() => { savedScale.value = scale.value; });
    const pan = Gesture.Pan().maxPointers(1).onStart(() => { blockSwipe.value = scale.value > 1; savedX.value = x.value; savedY.value = y.value; }).onUpdate(event => {
        if (scale.value > 1) {
            x.value = photoPanOffset(savedX.value + event.translationX, size.width, scale.value);
            y.value = photoPanOffset(savedY.value + event.translationY, size.height, scale.value);
        }
    }).onEnd(event => {
        if (!blockSwipe.value && scale.value <= 1 && Math.abs(event.translationX) > Math.abs(event.translationY)) {
            const direction = photoSwipeDirection(event.translationX, event.velocityX);
            if (direction) runOnJS(move)(direction);
        }
    });
    const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
    const image = images[index];
    return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
        <GestureHandlerRootView style={styles.root}>
            <View accessibilityViewIsModal style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(12, insets.bottom) }]}>
                <View style={styles.toolbar}>
                    <Text accessibilityLiveRegion="polite" style={styles.label}>{index + 1} of {images.length}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Close photo viewer" onPress={onClose} style={styles.button}><Feather name="x" size={24} color="#fff" /></Pressable>
                </View>
                <View style={styles.viewport} onLayout={event => setSize(event.nativeEvent.layout)}>
                    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
                        <Animated.View style={[styles.photo, imageStyle]}>
                            {image && <ChatImage key={image.attachment_id} token={token} conversationId={conversationId} attachment={image} fullSize />}
                        </Animated.View>
                    </GestureDetector>
                </View>
                <Text numberOfLines={2} style={styles.filename}>{image?.filename || 'Message photo'}</Text>
                <View style={styles.controls}>
                    <Pressable disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous photo" accessibilityState={{ disabled: index === 0 }} onPress={() => move(-1)} style={[styles.button, { opacity: index === 0 ? 0.3 : 1 }]}><Feather name="chevron-left" size={26} color="#fff" /></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Reset photo zoom" onPress={reset} style={styles.reset}><Text style={styles.label}>Reset zoom</Text></Pressable>
                    <Pressable disabled={index === images.length - 1} accessibilityRole="button" accessibilityLabel="Next photo" accessibilityState={{ disabled: index === images.length - 1 }} onPress={() => move(1)} style={[styles.button, { opacity: index === images.length - 1 ? 0.3 : 1 }]}><Feather name="chevron-right" size={26} color="#fff" /></Pressable>
                </View>
                <Text style={styles.hint}>Pinch to zoom · Swipe for more photos</Text>
            </View>
        </GestureHandlerRootView>
    </Modal>;
}
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#111111' },
    toolbar: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    label: { color: '#fff', fontSize: 14 },
    viewport: { flex: 1, overflow: 'hidden' },
    photo: { width: '100%', height: '100%' },
    filename: { color: '#d4d4d8', fontSize: 14, textAlign: 'center', marginHorizontal: 20, marginTop: 12 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    reset: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
    hint: { color: '#a1a1aa', fontSize: 12, textAlign: 'center', marginHorizontal: 16 },
});
