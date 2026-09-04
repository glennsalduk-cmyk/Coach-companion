// Contrepartie web de calls/[id].tsx. Les appels vidéo reposent sur
// @livekit/react-native-webrtc, un module natif sans équivalent sur le
// target web utilisé en développement (pas de simulateur iOS disponible ici)
// — voir lib/livekit-native-setup.native.ts pour le détail. Expo Router
// choisit automatiquement ce fichier plutôt que [id].tsx quand l'app tourne
// sur web.
import { Pressable, SafeAreaView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/lib/theme';

export default function CallScreenWebFallback() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: spacing.md }}>
        Appel vidéo indisponible sur le web
      </Text>
      <Text style={{ fontSize: 13.5, color: colors.inkSoft, lineHeight: 20, marginBottom: spacing.xl }}>
        Les appels vidéo utilisent la caméra et le micro via un module natif, non supporté par ce
        target web de développement. Teste cette fonctionnalité sur un simulateur ou un appareil
        réel (build Expo Dev Client / EAS).
      </Text>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>← Retour</Text>
      </Pressable>
    </SafeAreaView>
  );
}
