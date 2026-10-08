import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ImportStepIndicator } from './ImportStepIndicator';
import { Text } from '@/component/ui/Text';
import { DELIVERY_NOTE_READING_STAGES, DELIVERY_NOTE_WRAPPING_UP, startDeliveryNoteReading } from './delivery-note-reading-stages';

function useReduceMotion() {
    // Keep motion still until the system preference has been read.
    const [reduced, setReduced] = useState(true);
    useEffect(() => {
        let active = true;
        let preferenceChanged = false;
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
            preferenceChanged = true;
            setReduced(value);
        });
        AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (active && !preferenceChanged) setReduced(value);
        }).catch(() => { /* Retain the static illustration if the preference is unavailable. */ });
        return () => { active = false; subscription.remove(); };
    }, []);
    return reduced;
}

function DocumentScanner({ scanning, reduced, dark }: { scanning: boolean; reduced: boolean; dark: boolean }) {
    const sweep = useAnimatedValue(0);
    useEffect(() => {
        if (!scanning || reduced) return;
        const animation = Animated.loop(Animated.sequence([
            Animated.timing(sweep, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(sweep, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]));
        animation.start();
        return () => { animation.stop(); };
    }, [scanning, reduced, sweep]);
    return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.scanArea, { backgroundColor: dark ? '#281e22' : '#fff4f4' }]}>
        <View style={[styles.document, { backgroundColor: dark ? '#27272a' : '#fff', borderColor: dark ? '#52525b' : '#e4e4e7' }]}>
            <Feather name="file-text" size={23} color={dark ? '#fda4af' : '#c2292e'} />
            <View style={styles.documentLines}>
                {[100, 76, 92, 60].map((width, index) => <View key={index} style={[styles.documentLine, { width: `${width}%`, backgroundColor: dark ? '#52525b' : '#e4e4e7' }]} />)}
            </View>
            {scanning && <Animated.View style={[styles.scanBeam, { transform: [{ translateY: reduced ? 0 : sweep.interpolate({ inputRange: [0, 1], outputRange: [-44, 44] }) }] }]}>
                <View style={styles.scanLine} />
            </Animated.View>}
        </View>
        <View style={[styles.scannerBadge, { backgroundColor: dark ? '#3f242a' : '#ffe4e6' }]}>
            <Feather name={scanning ? 'search' : 'upload-cloud'} size={19} color={dark ? '#fda4af' : '#c2292e'} />
        </View>
    </View>;
}

function ReadingMessage({ ink }: { ink: string }) {
    const [index, setIndex] = useState(0);
    useEffect(() => startDeliveryNoteReading(setIndex), []);
    return <Text accessibilityLiveRegion="polite" style={[styles.title, { color: ink }]}>
        {DELIVERY_NOTE_READING_STAGES[index] ?? DELIVERY_NOTE_WRAPPING_UP}
    </Text>;
}

/** Upload is a real XHR stage; rotating reading messages are indeterminate. */
export function DeliveryNoteProgress({ uploaded = false, creating = false }: { uploaded?: boolean; creating?: boolean }) {
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === 'dark';
    const ink = dark ? '#fafafa' : '#18181b';
    const muted = dark ? '#a1a1aa' : '#71717a';
    const reduced = useReduceMotion();
    return <View style={styles.container}>
        <ImportStepIndicator step={creating ? 5 : 2} locked />
        {!creating && <DocumentScanner scanning={uploaded} reduced={reduced} dark={dark} />}
        <View style={styles.message}>
            {!creating && uploaded ? <ReadingMessage ink={ink} /> : <Text accessibilityLiveRegion="polite" style={[styles.title, { color: ink }]}>
                {creating ? 'Creating shipments…' : 'Uploading your file for analysis…'}
            </Text>}
            <Text style={[styles.description, { color: muted }]}>
                {creating ? 'Saving your reviewed shipments and assigning them to the selected run.'
                    : uploaded ? 'We’re working through your document. You’ll review the details before any shipments are created.'
                    : 'Keep this screen open while we upload your document.'}
            </Text>
        </View>
        <View style={styles.working}>
            {!reduced && <ActivityIndicator accessible={false} size="small" color="#f54a4a" />}
            <Text style={[styles.workingLabel, { color: muted }]}>{creating ? 'Saving your changes' : 'Please keep this screen open'}</Text>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    container: { gap: 16, paddingVertical: 8 },
    scanArea: { height: 152, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    document: { width: 86, height: 112, borderWidth: 1, borderRadius: 10, padding: 12, gap: 10, overflow: 'hidden' },
    documentLines: { gap: 7 },
    documentLine: { height: 3, borderRadius: 2 },
    scanBeam: { position: 'absolute', left: 0, right: 0, top: 48, height: 18, backgroundColor: 'rgba(245,74,74,0.12)' },
    scanLine: { height: 2, backgroundColor: '#f54a4a' },
    scannerBadge: { position: 'absolute', left: '50%', marginLeft: 28, bottom: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    message: { gap: 8 },
    title: { minHeight: 60, fontSize: 23, lineHeight: 30, fontWeight: '700' },
    description: { fontSize: 14, lineHeight: 21 },
    working: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
    workingLabel: { flex: 1, fontSize: 12, lineHeight: 18 },
});
