import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/src/providers/auth-provider';
import { RequiredDocumentsProvider, useRequiredDocuments } from '@/src/providers/required-documents-provider';

import { UnreadMessagesProvider, useUnreadMessages } from '@/src/providers/unread-messages-provider';

export default function TabLayout() {
  const { session } = useAuth();
  return <RequiredDocumentsProvider key={session?.token ?? 'signed-out'}><UnreadMessagesProvider><TabNavigator /></UnreadMessagesProvider></RequiredDocumentsProvider>;
}

function TabNavigator() {
  const { count } = useRequiredDocuments();
  const { count: unreadCount } = useUnreadMessages();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#15803d',
        tabBarInactiveTintColor: isDarkMode ? '#A1A1AA' : '#8A8A8A',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#111111' : '#FFFFFF',
          borderTopColor: isDarkMode ? '#27272A' : '#E7E5E4',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="runs"
        options={{
          title: 'Runs',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="point.topleft.down.to.point.bottomright.curvepath" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#15803d', color: '#FFFFFF' },
          tabBarAccessibilityLabel: unreadCount > 0 ? `Messages, ${unreadCount} unread messages` : 'Messages',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          tabBarBadge: count != null && count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: '#15803d', color: '#FFFFFF' },
          tabBarAccessibilityLabel: count != null && count > 0 ? `Documents, ${count} required ${count === 1 ? 'document' : 'documents'} to upload` : 'Documents',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="folder.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
