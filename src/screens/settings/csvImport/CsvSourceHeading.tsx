import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ForgeText as Text, Icon } from '../../../components/ui';
import { useForgeTheme } from '../../../theme/ThemeProvider';
import { scaleUI } from '../../../theme/scale';
import { typeScale } from '../../../theme/tokens';
import type { IconName } from '../../../types';
import type { CsvSource } from '../../../data/csvImport/types';

const sourceIcons: Record<CsvSource, IconName> = {
  hevy: 'brand-hevy',
  strong: 'brand-strong',
  fitnotes: 'brand-fitnotes',
  'fitnotes-ios': 'brand-fitnotes-ios',
  strive: 'database-import',
};

export function CsvSourceHeading({
  source,
  title,
  detected = false,
}: {
  source: CsvSource;
  title: string;
  detected?: boolean;
}) {
  const theme = useForgeTheme();
  return (
    <View style={styles.row}>
      <View
        testID={`csv-source-icon-${source}`}
        accessible={false}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.icon, { backgroundColor: theme.surfaceMuted }]}
      >
        <Icon name={sourceIcons[source]} size={scaleUI(23)} color={theme.textPrimary} />
      </View>
      <Text
        style={[
          styles.title,
          detected ? typeScale.sectionTitle : typeScale.cardTitle,
          { color: theme.textPrimary },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: scaleUI(10) },
  icon: {
    width: scaleUI(36),
    height: scaleUI(36),
    borderRadius: scaleUI(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, minWidth: 0 },
});
