import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import { chatApi, type ChatAttachment } from '@/src/lib/api';

type Props = { token: string; conversationId: string; attachment: ChatAttachment; fullSize?: boolean };

/** Resolve private, short-lived URLs only for mounted previews; never persist photo URLs/data. */
export function ChatImage({ token, conversationId, attachment, fullSize = false }: Props) {
    const [attempt, setAttempt] = useState(0);
    return <PrivateImage key={`${token}:${conversationId}:${attachment.attachment_id}:${attempt}`} token={token} conversationId={conversationId} attachment={attachment} fullSize={fullSize} onRetry={() => setAttempt(value => value + 1)} />;
}

function PrivateImage({ token, conversationId, attachment, fullSize, onRetry }: Props & { onRetry: () => void }) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let current = true;
        void chatApi.download(token, conversationId, attachment.attachment_id).then(result => {
            if (current) setUrl(result.url);
        }).catch(() => {
            if (current) { setFailed(true); setLoading(false); }
        });
        return () => { current = false; };
    }, [token, conversationId, attachment.attachment_id]);
    return <View style={[styles.frame, fullSize ? styles.fullSize : styles.thumbnail]}>
        {url && !failed && <Image key={url} source={{ uri: url }} contentFit={fullSize ? 'contain' : 'cover'} cachePolicy="none"
            accessible accessibilityLabel={attachment.filename || 'Message photo'} style={StyleSheet.absoluteFill}
            onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />}
        {loading && <ActivityIndicator accessibilityLabel="Loading photo" color={fullSize ? '#fff' : '#15803d'} />}
        {failed && <Pressable accessibilityRole="button" accessibilityLabel="Retry photo preview" onPress={onRetry} style={styles.retry}>
            <Feather name="image" size={24} color={fullSize ? '#fff' : '#71717a'} />
            <Text style={{ color: fullSize ? '#fff' : '#71717a', fontSize: 12 }}>Retry photo</Text>
        </Pressable>}
    </View>;
}
const styles = StyleSheet.create({
    frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    thumbnail: { width: 112, height: 112, borderRadius: 12, backgroundColor: '#e4e4e7' },
    fullSize: { width: '100%', height: '100%' },
    retry: { minWidth: 44, minHeight: 44, padding: 8, gap: 6, alignItems: 'center', justifyContent: 'center' },
});
