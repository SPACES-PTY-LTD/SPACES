import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';

type PageHeaderProps = { title: string; status?: string; leading?: ReactNode; action?: ReactNode };

/** Fixed tab heading; the screen owns its safe-area inset and scrolling body. */
export function PageHeader({ title, status, leading, action }: PageHeaderProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <View style={[styles.header, { borderBottomColor: dark ? '#303036' : '#ECECF0' }]}>
      <View style={styles.row}>
        {leading}
      <Text accessibilityRole="header" style={[styles.title, { color: dark ? '#FAFAFA' : '#111111' }]}>{title}</Text>
        {action}
      </View>
      {!!status && <Text style={[styles.status, { color: dark ? '#A1A1AA' : '#71717A' }]}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderBottomWidth: 1, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 28, lineHeight: 39, fontWeight: '700' },
  status: { fontSize: 14, lineHeight: 20 },
});
