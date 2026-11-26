import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

/** Page container. Pass `header` on stack screens that show a navigation header (it already handles the top inset). */
export function Screen({ children, scroll = true, header = false }: { children: ReactNode; scroll?: boolean; header?: boolean }) {
  const t = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={header ? [] : ['top']}>
      {body}
    </SafeAreaView>
  );
}

export function T({
  children,
  variant = 'body',
  style,
  ...rest
}: {
  children: ReactNode;
  variant?: 'title' | 'h2' | 'h3' | 'body' | 'small' | 'muted' | 'big';
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const t = useTheme();
  const v: Record<string, TextStyle> = {
    title: { fontSize: 30, fontWeight: '700', color: t.accent },
    h2: { fontSize: 20, fontWeight: '700', color: t.fg },
    h3: { fontSize: 16, fontWeight: '700', color: t.fg },
    body: { fontSize: 16, color: t.fg, lineHeight: 23 },
    small: { fontSize: 14, color: t.fg, lineHeight: 20 },
    muted: { fontSize: 14, color: t.muted, lineHeight: 20 },
    big: { fontSize: 30, fontWeight: '700', color: t.fg, fontVariant: ['tabular-nums'] },
  };
  return (
    <Text style={[{ textAlign: 'left', writingDirection: 'rtl' }, v[variant], style]} {...rest}>
      {children}
    </Text>
  );
}

export function Card({ children, soft, style }: { children: ReactNode; soft?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: soft ? t.surface2 : t.surface, borderColor: t.line },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'link';
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  if (kind === 'link') {
    return (
      <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
        <Text style={{ color: t.accent, fontWeight: '700', fontSize: 15, textAlign: 'left' }}>{title}</Text>
      </Pressable>
    );
  }
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: primary ? t.accent : t.surface,
          borderColor: primary ? t.accent : t.line,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? t.accentFg : t.accent} />
      ) : (
        <Text style={{ color: primary ? t.accentFg : t.fg, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ltr, ...input }: TextInputProps & { label: string; hint?: string; ltr?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontWeight: '600' }}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={t.muted}
        {...input}
        style={[
          styles.input,
          {
            color: t.fg,
            backgroundColor: t.surface,
            borderColor: t.line,
            // With RTL forced, the default alignment is already the start (right) side.
            writingDirection: ltr ? 'ltr' : 'rtl',
          },
          input.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null,
          input.style as TextStyle,
        ]}
      />
      {hint ? <T variant="muted">{hint}</T> : null}
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: [V, string][];
  value: V;
  onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.seg, { borderColor: t.line }]} accessibilityRole="radiogroup">
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: on ? t.accentSoft : t.surface }}>
            <Text style={{ color: on ? t.accent : t.fg, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'ok' | 'acc' | 'warn' | 'honey' }) {
  const t = useTheme();
  const c = {
    plain: [t.surface2, t.muted],
    ok: [t.okSoft, t.ok],
    acc: [t.accentSoft, t.accent],
    warn: [t.warnSoft, t.warn],
    honey: [t.honeySoft, t.honey],
  }[tone];
  return (
    <View style={{ backgroundColor: c[0], borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ color: c[1], fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(value === n ? 0 : n)}
          accessibilityLabel={`${n} כוכבים`}
          hitSlop={4}>
          <Text style={{ fontSize: size, color: n <= value ? t.honey : t.line }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Avatar({ name, size = 56, color }: { name: string; size?: number; color?: string }) {
  const t = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color || t.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
});
