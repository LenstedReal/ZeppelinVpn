import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, space } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBox}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toLocaleUpperCase()}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  small,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        variantStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, variant === 'primary' && styles.buttonTextPrimary, variant === 'danger' && styles.buttonTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.crimson, borderColor: colors.crimsonBright },
  secondary: { backgroundColor: colors.surfaceHigh, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.redDeep, borderColor: '#5A1A1D' },
});

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={styles.toggleText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong, true: colors.crimson }}
        thumbColor={value ? '#FFFFFF' : colors.steel}
      />
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]} numberOfLines={1} selectable>
        {value}
      </Text>
    </View>
  );
}

const toneColors = {
  info: { bg: colors.surfaceHigh, border: colors.borderStrong, title: colors.text },
  ok: { bg: colors.greenDeep, border: '#1C4A31', title: colors.green },
  warn: { bg: colors.amberDeep, border: '#5A4313', title: colors.amber },
  error: { bg: colors.redDeep, border: '#5A1A1D', title: colors.red },
};

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof toneColors;
  title?: string;
  children?: React.ReactNode;
}) {
  const c = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]}>
      {title ? <Text style={[styles.noticeTitle, { color: c.title }]}>{title}</Text> : null}
      {typeof children === 'string' ? <Text style={styles.noticeBody}>{children}</Text> : children}
    </View>
  );
}

export function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function CodeBlock({ code, copyLabel, onCopy }: { code: string; copyLabel: string; onCopy: (code: string) => void }) {
  return (
    <View style={styles.code}>
      <Text style={styles.codeText} selectable>
        {code}
      </Text>
      <Button label={copyLabel} small onPress={() => onCopy(code)} style={styles.codeButton} />
    </View>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textDim} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, paddingBottom: space.xl * 2 },
  titleBox: { marginBottom: space.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: space.xs },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 34, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  buttonTextSmall: { fontSize: 13 },
  buttonTextPrimary: { color: '#FFFFFF' },
  buttonTextDanger: { color: colors.red },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  toggleText: { flex: 1 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segment: { flexGrow: 1, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.crimsonDeep, borderWidth: 1, borderColor: colors.crimson },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, gap: space.md },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: space.xs },
  noticeBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  bullet: { flexDirection: 'row', marginTop: space.xs, paddingRight: space.sm },
  bulletDot: { color: colors.crimson, fontSize: 14, lineHeight: 20, width: 14 },
  bulletText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, flex: 1 },
  code: {
    backgroundColor: '#08090C',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  codeText: { color: '#E8E9EC', fontFamily: font.mono, fontSize: 12.5, lineHeight: 18 },
  codeButton: { alignSelf: 'flex-end', marginTop: space.sm },
  field: { marginBottom: space.md },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: space.xs },
  input: {
    backgroundColor: '#08090C',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border, marginVertical: space.sm },
});
