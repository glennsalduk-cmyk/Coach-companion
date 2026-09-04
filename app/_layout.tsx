import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';
// Résolu en .native.ts (registerGlobals LiveKit) ou .web.ts (no-op) selon la
// plateforme — voir lib/livekit-native-setup.native.ts.
import '@/lib/livekit-native-setup';

function RootNavigation() {
  const { initializing, session, profile, loadingProfile } = useAuth();
  // Casté en string[] : useSegments() infère un type tuple selon les routes
  // typées existantes, dont certaines n'ont qu'un seul segment — l'accès à
  // segments[1] ci-dessous ferait alors échouer la vérification de types.
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (initializing || loadingProfile) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && !profile && segments[1] !== 'role') {
      // Connecté mais onboarding pas terminé (pas encore de rôle choisi).
      router.replace('/role');
    } else if (session && profile && !inAppGroup) {
      router.replace('/');
    }
  }, [initializing, loadingProfile, session, profile, segments, router]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
