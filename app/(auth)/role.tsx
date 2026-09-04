import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, ScreenTitle, TextField } from '@/components/ui';
import type { AppRole } from '@/lib/database.types';

const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: 'coach', label: 'Je suis coach', description: 'Je gère des clients, des programmes et mon activité.' },
  { value: 'coache', label: 'Je suis coaché', description: 'Je suis accompagné par un coach au quotidien.' },
];

export default function RoleSelection() {
  const { session, refreshProfile } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setError(null);
    if (!session) return;
    if (!role) {
      setError('Choisis ton profil pour continuer.');
      return;
    }
    if (!fullName.trim()) {
      setError('Renseigne ton nom.');
      return;
    }
    setLoading(true);
    const { error: insertError } = await supabase.from('profiles').insert({
      id: session.user.id,
      role,
      full_name: fullName.trim(),
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await refreshProfile();
    // RootNavigation redirige automatiquement vers /(app) une fois le profil chargé.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 80, flexGrow: 1 }}>
        <ScreenTitle>Bienvenue</ScreenTitle>
        <Text style={{ color: colors.inkFaint, fontSize: 13, marginTop: -12, marginBottom: spacing.xl }}>
          Encore une étape avant de commencer.
        </Text>

        <FieldLabel>Ton nom</FieldLabel>
        <TextField value={fullName} onChangeText={setFullName} placeholder="ex. Camille Moreau" />

        <FieldLabel>Tu es…</FieldLabel>
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          {ROLE_OPTIONS.map((option) => {
            const selected = role === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setRole(option.value)}
                style={{
                  borderRadius: radius.lg,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                  padding: spacing.lg,
                }}
              >
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{option.label}</Text>
                <Text style={{ fontSize: 12, color: colors.inkFaint, marginTop: 4 }}>
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ErrorText>{error}</ErrorText>

        <PrimaryButton label="Continuer" onPress={handleContinue} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}
