import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { chatApi, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

let visibleChat: string | null = null;
export function setVisibleDriverChat(id: string | null) {
    visibleChat = id;
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
    const { session } = useAuth();
    const router = useRouter();
    useEffect(() => {
        const token = session?.token;
        if (!token || Platform.OS === 'web') return;
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
            const projectId =
                Constants.easConfig?.projectId ??
                Constants.expoConfig?.extra?.eas?.projectId;
            if (!projectId) return;
            const push = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            if (!live) return;
            await driverApi.registerDevice(token!, {
                platform: Platform.OS,
                push_provider: 'expo',
                push_token: push.data,
                device_name: Device.deviceName ?? undefined,
            });
        }
        async function open(response: Notifications.NotificationResponse) {
            const data = response.notification.request.content.data ?? {};
            if (
                data.kind !== 'driver_message' ||
                typeof data.conversation_id !== 'string'
            )
                return;
            try {
                const conversation = await chatApi.show(
                    token!,
                    data.conversation_id,
                );
                if (!live || conversation.type !== 'driver') return;
                await Notifications.clearLastNotificationResponseAsync();
                router.push('/(tabs)/messages');
            } catch {
                /* Ignore inaccessible conversations and keep the current screen. */
            }
        }
        if (isExpoGo) return;
        void register().catch(() => {
            /* Chat remains available without notification credentials or permission. */
        });
        void Notifications.getLastNotificationResponseAsync().then(
            (response) => {
                if (response && live) void open(response);
            },
        );
        const subscription =
            Notifications.addNotificationResponseReceivedListener(
                (response) => {
                    void open(response);
                },
            );
        const tokenSubscription = Notifications.addPushTokenListener(() => {
            void register().catch(() => {});
        });
        return () => {
            live = false;
            subscription.remove();
            tokenSubscription.remove();
            visibleChat = null;
        };
    }, [session?.token, router]);
    return null;
}
