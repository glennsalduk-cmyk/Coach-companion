import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, ScreenTitle, SecondaryLink, TextField } from '@/components/ui';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Renseigne ton email et ton mot de passe.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) setError(signInError.message);
    // Si succès, RootNavigation (app/_layout.tsx) redirige automatiquement
    // via l'écoute de onAuthStateChange — pas besoin de router.push ici.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 80, flexGrow: 1 }}>
          <ScreenTitle>Bon retour</ScreenTitle>

          <FieldLabel>Email</FieldLabel>
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="toi@exemple.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <FieldLabel>Mot de passe</FieldLabel>
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />

          <ErrorText>{error}</ErrorText>

          <PrimaryButton label="Se connecter" onPress={handleSignIn} loading={loading} />

          <SecondaryLink
            label="Pas encore de compte ? Inscris-toi"
            onPress={() => router.push('/sign-up')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
