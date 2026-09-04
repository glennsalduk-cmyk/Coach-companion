import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, PrimaryButton } from '@/components/ui';
import type { ProgramExerciseWithDetails, SessionFeeling } from '@/lib/database.types';

interface SetDraft {
  weightKg: string;
  reps: string;
  rpe: string;
  completed: boolean;
}

const FEELINGS: { value: SessionFeeling; label: string }[] = [
  { value: 'facile', label: 'Facile' },
  { value: 'normal', label: 'Normal' },
  { value: 'difficile', label: 'Difficile' },
];

function parseSetCount(sets: string | null): number {
  const n = parseInt(sets ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export default function LogSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<ProgramExerciseWithDetails[]>([]);
  const [drafts, setDrafts] = useState<Record<string, SetDraft[]>>({});
  const [feeling, setFeeling] = useState<SessionFeeling | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error: fetchError } = await supabase
      .from('program_exercises')
      .select('*, exercise:exercises(*)')
      .eq('program_id', id)
      .order('position', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as ProgramExerciseWithDetails[];
    setItems(list);
    const initialDrafts: Record<string, SetDraft[]> = {};
    for (const item of list) {
      const count = parseSetCount(item.sets);
      initialDrafts[item.id] = Array.from({ length: count }, () => ({
        weightKg: '',
        reps: item.reps ?? '',
        rpe: '',
        completed: false,
      }));
    }
    setDrafts(initialDrafts);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function updateSet(programExerciseId: string, setIndex: number, patch: Partial<SetDraft>) {
    setDrafts((prev) => {
      const next = { ...prev };
      const list = [...(next[programExerciseId] ?? [])];
      list[setIndex] = { ...list[setIndex], ...patch };
      next[programExerciseId] = list;
      return next;
    });
  }

  async function handleFinish() {
    if (!profile || !id) return;
    setError(null);
    setSaving(true);

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({ client_id: profile.id, program_id: id, feeling })
      .select()
      .single();

    if (sessionError || !session) {
      setSaving(false);
      setError(sessionError?.message ?? 'Impossible de créer la séance.');
      return;
    }

    const rows = items.flatMap((item) =>
      (drafts[item.id] ?? []).map((set, index) => ({
        session_id: session.id,
        exercise_id: item.exercise_id,
        set_number: index + 1,
        weight_kg: set.weightKg ? Number(set.weightKg.replace(',', '.')) : null,
        reps_done: set.reps ? parseInt(set.reps, 10) : null,
        rpe: set.rpe ? Number(set.rpe.replace(',', '.')) : null,
        completed: set.completed,
      }))
    );

    if (rows.length > 0) {
      const { error: setsError } = await supabase.from('session_sets').insert(rows);
      if (setsError) {
        setSaving(false);
        setError(setsError.message);
        return;
      }
    }

    setSaving(false);
    router.replace(`/programs/${id}`);
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: spacing.xl }}>
          Séance en cours
        </Text>

        {error && <ErrorText>{error}</ErrorText>}

        {items.map((item) => (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 14, marginBottom: spacing.md }}>
              {item.exercise?.name}
            </Text>
            {(drafts[item.id] ?? []).map((set, index) => (
              <View
                key={index}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}
              >
                <Text style={{ width: 18, fontSize: 12, color: colors.inkFaint, fontWeight: '700' }}>
                  {index + 1}
                </Text>
                <SetInput
                  placeholder="kg"
                  value={set.weightKg}
                  onChangeText={(v) => updateSet(item.id, index, { weightKg: v })}
                />
                <SetInput
                  placeholder="reps"
                  value={set.reps}
                  onChangeText={(v) => updateSet(item.id, index, { reps: v })}
                />
                <SetInput
                  placeholder="RPE"
                  value={set.rpe}
                  onChangeText={(v) => updateSet(item.id, index, { rpe: v })}
                />
                <Pressable
                  onPress={() => updateSet(item.id, index, { completed: !set.completed })}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: set.completed ? colors.coral : colors.bg,
                    borderWidth: 1,
                    borderColor: set.completed ? colors.coral : colors.border,
                  }}
                >
                  <Text style={{ color: set.completed ? 'white' : colors.inkFaint, fontWeight: '700' }}>✓</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <Text style={{ fontWeight: '700', fontSize: 14, marginTop: spacing.md, marginBottom: spacing.md }}>
          Comment c’était ?
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          {FEELINGS.map((f) => {
            const selected = feeling === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFeeling(f.value)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: selected ? colors.coralSoft : colors.card,
                  borderWidth: 1,
                  borderColor: selected ? colors.coral : colors.border,
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 12.5, color: selected ? colors.coral : colors.inkSoft }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label="Terminer la séance" onPress={handleFinish} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SetInput({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      keyboardType="numeric"
      style={{
        flex: 1,
        height: 36,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        textAlign: 'center',
        fontSize: 12.5,
        color: colors.ink,
      }}
    />
  );
}
