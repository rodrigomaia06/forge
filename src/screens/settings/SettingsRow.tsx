import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  ForgeCard,
  ForgeText as Text,
  Icon,
  lightHaptic,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { IconName } from '../../types';

export const settingsLayout = {
  screenPadding: 20,
  contentTop: 20,
  contentBottom: 40,
  rootContentBottom: 112,
  sectionGap: 20,
  listGap: 14,
} as const;

type SettingsHaptic = 'light' | 'selection' | 'none';

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconBackgroundColor?: string;
  iconSize?: number;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  disclosure?: boolean;
  destructive?: boolean;
  showDivider?: boolean;
  onPress?: () => void;
  haptic?: SettingsHaptic;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function SettingsRow({
  title,
  subtitle,
  icon,
  iconColor,
  iconBackgroundColor,
  iconSize = 22,
  leading,
  trailing,
  disclosure = false,
  destructive = false,
  showDivider = false,
  onPress,
  haptic = 'light',
  disabled = false,
  accessibilityLabel = title,
  accessibilityRole = onPress ? 'button' : undefined,
  accessibilityState,
  testID,
  style,
}: SettingsRowProps) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const hasLeading = Boolean(leading || icon);
  const content = (
    <>
      {leading ??
        (icon ? (
          iconBackgroundColor ? (
            <View style={[styles.iconFrame, { backgroundColor: iconBackgroundColor }]}>
              <Icon name={icon} size={iconSize} color={iconColor ?? theme.textPrimary} />
            </View>
          ) : (
            <View style={styles.iconSlot}>
              <Icon name={icon} size={iconSize} color={iconColor ?? theme.textPrimary} />
            </View>
          )
        ) : null)}
      <View style={styles.copy}>
        <Text
          testID={testID ? `${testID}-title` : undefined}
          style={[styles.title, { color: destructive ? theme.textDestructive : theme.textPrimary }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {disclosure ? <Icon name="chevron-forward" size={18} color={theme.textSecondary} /> : null}
      {showDivider ? (
        <View
          pointerEvents="none"
          style={[
            styles.divider,
            hasLeading && (iconBackgroundColor ? styles.framedDivider : styles.leadingDivider),
            { backgroundColor: theme.divider },
          ]}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, subtitle && styles.supportingRow, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      testID={testID}
      onPress={() => {
        if (haptic === 'light') lightHaptic();
        if (haptic === 'selection') selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        subtitle && styles.supportingRow,
        style,
        pressed && pressedFeedback,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function SettingsSection({
  title,
  footer,
  children,
  style,
  cardStyle,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      ) : null}
      <ForgeCard variant="elevated" style={cardStyle}>
        {children}
      </ForgeCard>
      {footer ? (
        <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    row: {
      minHeight: 56,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    supportingRow: { minHeight: 68, paddingVertical: 10 },
    iconSlot: { width: 24, alignItems: 'center', justifyContent: 'center' },
    iconFrame: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
    title: { ...typeScale.cardTitle, color: theme.ink },
    subtitle: { ...typeScale.supporting, color: theme.slate, marginTop: 1 },
    divider: {
      position: 'absolute',
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
      right: 18,
      bottom: 0,
      left: 18,
    },
    leadingDivider: { left: 54 },
    framedDivider: { left: 70 },
    section: { gap: 8 },
    sectionTitle: { ...typeScale.label, marginLeft: 6 },
    footer: { ...typeScale.caption, paddingHorizontal: 6 },
  });
