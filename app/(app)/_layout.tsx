import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>
  );
}

export default function AppLayout() {
  const { profile } = useAuth();
  const isCoach = profile?.role === 'coach';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programmes',
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏋️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          href: isCoach ? undefined : null, // masqué pour un coaché
          tabBarIcon: ({ focused }) => <TabIcon symbol="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
