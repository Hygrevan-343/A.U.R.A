// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Chrome as Home, Settings } from 'lucide-react-native';
import { RequireAuth } from '@/components/RequireAuth';
import { useTheme } from '@/hooks/useTheme';

export default function TabLayout() {
  const { isDarkMode } = useTheme();

  return (
    <RequireAuth>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#1F2937' : '#fff',
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#374151' : '#E5E7EB',
          },
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: isDarkMode ? '#9CA3AF' : '#6B7280',
          tabBarLabelStyle: {
            fontFamily: 'Poppins-Regular',
            fontSize: 12,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          }}
        />
      </Tabs>
    </RequireAuth>
  );
}