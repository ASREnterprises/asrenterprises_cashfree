import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Octicons } from '@expo/vector-icons';
import { Colors } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthContext';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.secondaryAccent,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Octicons name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Octicons name="search" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Octicons name="person" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
