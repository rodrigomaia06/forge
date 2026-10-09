import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ForgeCard, ForgePressable, ForgeText as Text, Icon } from '../../../components/ui';
import { useForgeTheme } from '../../../theme/ThemeProvider';
import { typeScale } from '../../../theme/tokens';
import { scaleUI } from '../../../theme/scale';

export interface CsvReviewRow {
  key: string;
  title: string;
  detail?: string;
  checked?: boolean;
  onPress?: () => void;
}
export function CsvImportRow({ item, busy }: { item: CsvReviewRow; busy: boolean }) {
  const theme = useForgeTheme();
  const webKeyboard =
    Platform.OS === 'web' && item.checked !== undefined
      ? {
          onKeyDown: (event: {
            nativeEvent: { key: string };
            preventDefault(): void;
            stopPropagation(): void;
          }) => {
            if (event.nativeEvent.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              if (!busy) item.onPress?.();
            }
          },
        }
      : {};
  return (
    <ForgeCard style={styles.card}>
      <ForgePressable
        {...webKeyboard}
        accessibilityRole={
          item.checked === undefined ? (item.onPress ? 'button' : undefined) : 'checkbox'
        }
        accessibilityState={{ checked: item.checked, disabled: busy }}
        aria-checked={item.checked}
        accessibilityLabel={item.title}
        disabled={busy || !item.onPress}
        onPress={item.onPress}
        style={styles.row}
      >
        {item.checked !== undefined ? (
          <View
            style={[
              styles.check,
              {
                borderColor: item.checked ? theme.selectionIndicator : theme.textSecondary,
                backgroundColor: item.checked ? theme.selectionIndicator : 'transparent',
              },
            ]}
          >
            {item.checked ? <Icon name="check" size={16} color={theme.onActionPrimary} /> : null}
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
          {item.detail ? (
            <Text style={[styles.detail, { color: theme.textSecondary }]}>{item.detail}</Text>
          ) : null}
        </View>
        {item.onPress && item.checked === undefined ? (
          <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
        ) : null}
      </ForgePressable>
    </ForgeCard>
  );
}
const styles = StyleSheet.create({
  card: { marginBottom: scaleUI(10) },
  row: {
    padding: scaleUI(16),
    minHeight: Math.max(44, scaleUI(60)),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleUI(12),
  },
  copy: { flex: 1, minWidth: 0, gap: scaleUI(5) },
  title: { ...typeScale.cardTitle },
  detail: { ...typeScale.supporting },
  check: {
    width: scaleUI(24),
    height: scaleUI(24),
    borderWidth: 2,
    borderRadius: scaleUI(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
