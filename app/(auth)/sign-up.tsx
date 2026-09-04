import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, ScreenTitle, SecondaryLink, TextField } from '@/components/ui';

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError('Email valide et mot de passe d’au moins 8 caractères requis.');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // Selon la config du projet Supabase, une confirmation par email peut être
    // requise avant que la session ne soit active. Si la session est déjà
    // active, RootNavigation redirige automatiquement vers /(auth)/role.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 80, flexGrow: 1 }}>
          <ScreenTitle>Créer un compte</ScreenTitle>

          <FieldLabel>Email</FieldLabel>
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="toi@exemple.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <FieldLabel>Mot de passe (8 caractères min.)</FieldLabel>
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
          />

          <ErrorText>{error}</ErrorText>

          <PrimaryButton label="S’inscrire" onPress={handleSignUp} loading={loading} />

          <SecondaryLink
            label="Déjà un compte ? Connecte-toi"
            onPress={() => router.push('/sign-in')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
