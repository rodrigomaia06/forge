import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ForgeCard, ForgePressable, ForgeText as Text, Icon } from '../../../components/ui';
import { useForgeTheme } from '../../../theme/ThemeProvider';
import { typeScale } from '../../../theme/tokens';
import type { IconName } from '../../../types';
import { scaleUI } from '../../../theme/scale';
import { CompletionCheck } from '../../activeWorkout/CompletionCheck';

export interface CsvReviewRow {
  key: string;
  title: string;
  detail?: string;
  checked?: boolean;
  icon?: IconName;
  iconTestID?: string;
  disabled?: boolean;
  status?: string;
  value?: string | number;
  inset?: boolean;
  onPress?: () => void;
}
export function CsvImportRow({
  item,
  busy,
  grouped = true,
  first = false,
  last = false,
  embedded = false,
}: {
  item: CsvReviewRow;
  busy: boolean;
  grouped?: boolean;
  first?: boolean;
  last?: boolean;
  embedded?: boolean;
}) {
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
  const RowSurface = item.onPress ? ForgePressable : View;
  const content = (
    <RowSurface
      {...webKeyboard}
      accessibilityRole={
        item.checked === undefined ? (item.onPress ? 'button' : undefined) : 'checkbox'
      }
      accessible={item.onPress ? undefined : true}
      accessibilityState={
        item.onPress ? { checked: item.checked, disabled: busy || item.disabled } : undefined
      }
      aria-checked={item.checked}
      accessibilityLabel={
        item.onPress
          ? item.title
          : [item.title, item.value, item.status, item.detail]
              .filter((value) => value !== undefined)
              .join('. ')
      }
      accessibilityHint={[item.detail, item.status].filter(Boolean).join('. ') || undefined}
      {...(item.onPress ? { disabled: busy || item.disabled, onPress: item.onPress } : {})}
      style={[
        styles.row,
        item.inset && styles.inset,
        grouped &&
          !last && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.divider,
          },
      ]}
    >
      {item.icon ? (
        <View testID={item.iconTestID} accessible={false} aria-hidden>
          <Icon name={item.icon} size={scaleUI(20)} color={theme.textSecondary} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
        {item.status ? (
          <Text style={[styles.status, { color: theme.textPrimary }]}>{item.status}</Text>
        ) : null}
        {item.detail ? (
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{item.detail}</Text>
        ) : null}
      </View>
      {item.value !== undefined ? (
        <Text style={[styles.title, { color: theme.textPrimary }]}>{item.value}</Text>
      ) : null}
      {item.checked !== undefined ? (
        <CompletionCheck selected={item.checked} tone="interactive" />
      ) : null}
      {item.onPress && !item.disabled && item.checked === undefined ? (
        <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
      ) : null}
    </RowSurface>
  );
  return embedded ? (
    content
  ) : (
    <ForgeCard
      size="compact"
      segment={first ? (last ? 'only' : 'first') : last ? 'last' : 'middle'}
    >
      {content}
    </ForgeCard>
  );
}
const styles = StyleSheet.create({
  inset: { paddingLeft: scaleUI(52) },
  status: { ...typeScale.label },
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
});

/** Small summaries reuse the same row treatment as the virtualized review. */
export function CsvImportSummary({ rows }: { rows: RowSummary[] }) {
  return (
    <ForgeCard size="compact">
      {rows.map((item, index) => (
        <CsvImportRow
          key={item.key}
          item={item}
          busy={false}
          embedded
          last={index === rows.length - 1}
        />
      ))}
    </ForgeCard>
  );
}
type RowSummary = Pick<CsvReviewRow, 'key' | 'title' | 'detail' | 'icon' | 'value'>;
