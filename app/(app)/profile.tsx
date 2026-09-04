import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, ScreenTitle, SecondaryLink, TextField } from '@/components/ui';

export default function ProfileScreen() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!profile) return;
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshProfile();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 60 }}>
        <ScreenTitle>Mon profil</ScreenTitle>

        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.inkFaint, fontWeight: '700' }}>COMPTE</Text>
          <Text style={{ fontSize: 13, color: colors.ink, marginTop: 4 }}>{session?.user.email}</Text>
          <Text style={{ fontSize: 11, color: colors.inkFaint, fontWeight: '700', marginTop: spacing.md }}>
            RÔLE
          </Text>
          <Text style={{ fontSize: 13, color: colors.ink, marginTop: 4 }}>
            {profile?.role === 'coach' ? 'Coach' : 'Coaché'}
          </Text>
        </View>

        <FieldLabel>Nom affiché</FieldLabel>
        <TextField value={fullName} onChangeText={setFullName} placeholder="Ton nom" />
        <ErrorText>{error}</ErrorText>
        <PrimaryButton label="Enregistrer" onPress={handleSave} loading={saving} />

        <SecondaryLink label="Se déconnecter" onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}
