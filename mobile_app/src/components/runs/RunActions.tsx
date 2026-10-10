import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DriverDashboard } from '@/src/lib/api';
import { RunActionForm, type RunAction } from '../dashboard/RunActionForm';
import { DeliveryOrderSheet } from '../dashboard/DeliveryOrderSheet';

type Props = {
    token: string;
    ownerId: string;
    run: NonNullable<DriverDashboard['current_run']>;
    reference?: string;
    canUploadDeliveryNote?: boolean;
    disabled?: boolean;
    onSaved: () => void;
};

/** One button, menu and action-sheet workflow shared by dashboard and active run details. */
export function RunActions(props: Props) {
    if (props.run.status !== 'in_progress') return null;
    return <ActiveRunActions key={`${props.token}:${props.run.run_id}:${!!props.disabled}:${props.run.end_request?.status}`} {...props} />;
}

function ActiveRunActions({ token, ownerId, run, reference = 'Current run', canUploadDeliveryNote = run.has_delivery_note === false, disabled = false, onSaved }: Props) {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === 'dark';
    const menu = useRef<ActionSheetRef>(null);
    const alive = useRef(true);
    const [action, setAction] = useState<RunAction | 'order' | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const choose = (next: RunAction | 'order') => { if (alive.current && !disabled) setAction(next); };
    function open() {
        if (disabled) return;
        menu.current?.present({ title: '', actions: [
            { id: 'edit', label: 'Edit Run', onPress: () => choose('edit') },
            { id: 'order', label: 'Update delivery order', onPress: () => choose('order') },
            { id: 'cost', label: 'Add additional cost', onPress: () => choose('cost') },
            ...(canUploadDeliveryNote ? [{ id: 'upload-delivery-note', label: 'Upload delivery note', onPress: () => {
                if (alive.current && !disabled) router.push({ pathname: '/shipments/load', params: { run_id: run.run_id } });
            } }] : []),
            { id: 'message-dispatch', label: 'Message dispatch', onPress: () => {
                if (alive.current && !disabled) router.push({ pathname: '/(tabs)/messages', params: {
                    draft_run_id: run.run_id, draft_run_label: reference, draft_run_request: Crypto.randomUUID(), draft_owner: ownerId,
                } });
            } },
            { id: 'end', label: 'End Run', variant: 'destructive', disabled: run.end_request?.status === 'pending', onPress: () => {
                if (run.end_request?.status !== 'pending') choose('end');
            } },
        ] });
    }
    function saved() { setAction(null); onSaved(); }
    return <>
        <Pressable accessibilityRole="button" accessibilityLabel="Run actions" accessibilityState={{ disabled }} disabled={disabled} onPress={open}
            style={[styles.button, { borderColor: dark ? '#303036' : '#dbdbe0', opacity: disabled ? 0.45 : 1 }]}>
            <Text style={[styles.text, { color: dark ? '#fafafa' : '#111111' }]}>Actions</Text>
        </Pressable>
        <ActionSheet ref={menu} />
        {action === 'order' && <DeliveryOrderSheet token={token} runId={run.run_id} onDismiss={() => setAction(null)} onSaved={saved} />}
        {action && action !== 'order' && <RunActionForm key={action} action={action} token={token} run={run} onDismiss={() => setAction(null)} onSaved={saved} />}
    </>;
}
const styles = StyleSheet.create({
    button: { width: 100, minHeight: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    text: { fontSize: 16, fontWeight: '600' },
});
