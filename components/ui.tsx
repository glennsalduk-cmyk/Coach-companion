import { Text, TextInput, Pressable, ActivityIndicator, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 24, fontWeight: '700', color: colors.ink, marginBottom: spacing.lg }}>
      {children}
    </Text>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: spacing.sm }}>
      {children}
    </Text>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      style={{
        height: 48,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        paddingHorizontal: spacing.lg,
        fontSize: 14,
        color: colors.ink,
        marginBottom: spacing.lg,
      }}
      {...props}
    />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <Text style={{ color: colors.coral, fontSize: 12.5, fontWeight: '600', marginBottom: spacing.lg }}>
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={{
        height: 52,
        borderRadius: radius.md,
        backgroundColor: isDisabled ? colors.border : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={{ color: isDisabled ? colors.inkFaint : 'white', fontSize: 14.5, fontWeight: '700' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function SecondaryLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginTop: spacing.lg, alignItems: 'center' }}>
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
