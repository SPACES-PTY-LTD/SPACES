import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';
import { driverMessageTarget } from '@/src/lib/driver-message-notification';

let visibleChat: string | null = null;
export function setVisibleDriverChat(id: string | null) {
    visibleChat = id;
}

export async function registerMessageNotificationDevice(token: string, isCurrent = () => true) {
    if (Platform.OS === 'web' || Constants.appOwnership === 'expo' || !Device.isDevice) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted || !isCurrent()) return;
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!isCurrent()) return;
    await driverApi.registerDevice(token, {
        platform: Platform.OS,
        push_provider: 'expo',
        push_token: push.data,
        device_name: Device.deviceName ?? undefined,
    });
}
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data ?? {};
        const show = !(
            data.kind === 'driver_message' &&
            data.conversation_id === visibleChat
        );
        return {
            shouldPlaySound: show,
            shouldSetBadge: false,
            shouldShowBanner: show,
            shouldShowList: show,
        };
    },
});

export function MessageNotifications() {
    const { session, isHydrating } = useAuth();
    const router = useRouter();
    const navigation = useRootNavigationState();
    const segments = useSegments();
    const [response, setResponse] =
        useState<Notifications.NotificationResponse | null>(() =>
            Platform.OS === 'web' || Constants.appOwnership === 'expo'
                ? null
                : Notifications.getLastNotificationResponse(),
        );
    const handled = useRef<string | null>(null);

    // Capture taps independently of authentication, including a cold-start tap.
    useEffect(() => {
        if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return;
        const subscription =
            Notifications.addNotificationResponseReceivedListener(setResponse);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (
            !response ||
            !session ||
            isHydrating ||
            !navigation?.key ||
            segments[0] === '(auth)'
        )
            return;
        if (
            response.actionIdentifier !==
            Notifications.DEFAULT_ACTION_IDENTIFIER
        )
            return;
        const target = driverMessageTarget(
            response.notification.request.content.data ?? {},
        );
        const identifier = response.notification.request.identifier;
        if (!target || handled.current === identifier) return;
        // The Messages screen authorizes the thread through the existing show API.
        // Navigation itself must work even when the network is temporarily offline.
        router.push(target);
        handled.current = identifier;
        Notifications.clearLastNotificationResponse();
    }, [response, session, isHydrating, navigation?.key, segments, router]);
    useEffect(() => {
        const token = session?.token;
        if (!token || isHydrating || Platform.OS === 'web') return;
        let live = true;
        const isExpoGo = Constants.appOwnership === 'expo';
        async function register() {
            if (!Device.isDevice || isExpoGo) return;
            if (Platform.OS === 'android')
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Messages',
                    importance: Notifications.AndroidImportance.HIGH,
                });
            let permission = await Notifications.getPermissionsAsync();
            if (!permission.granted)
                permission = await Notifications.requestPermissionsAsync();
            if (!permission.granted || !live) return;
            await registerMessageNotificationDevice(token!, () => live);
        }
        if (isExpoGo) return;
        const registerSafely = () =>
            void register().catch(() => {
                /* Chat remains available without notification credentials or permission. */
            });
        registerSafely();
        // Retry token registration after connectivity/notification settings change.
        const foreground = AppState.addEventListener('change', (state) => {
            if (state === 'active') registerSafely();
        });
        const tokenSubscription = Notifications.addPushTokenListener(() => {
            void register().catch(() => {});
        });
        return () => {
            live = false;
            foreground.remove();
            tokenSubscription.remove();
            visibleChat = null;
        };
    }, [session?.token, isHydrating]);
    return null;
}
