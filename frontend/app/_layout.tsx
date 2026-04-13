import { Stack } from 'expo-router';
import { AuthProvider } from '@/src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="repo-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="file-viewer" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </AuthProvider>
  );
}
