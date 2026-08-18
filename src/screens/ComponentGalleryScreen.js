import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNavigation } from '../components/BottomNavigation';
import { Button, Divider, NavigationItem, SectionHeader } from '../components/ui';
import { colors, spacing } from '../theme/tokens';

export function ComponentGalleryScreen() {
  const [selectedNavigation, setSelectedNavigation] = useState('Dashboard');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Internal review</Text>
        <Text style={styles.title}>Component gallery</Text>
        <Text style={styles.intro}>
          A focused view of Forge’s reusable cross-platform primitives. This is a development aid,
          not a product screen.
        </Text>

        <SectionHeader title="Actions" meta="Primary and secondary" />
        <View style={styles.row}>
          <Button label="Start workout" icon="add" onPress={() => {}} />
          <Button label="Add exercise" icon="add" variant="secondary" onPress={() => {}} />
        </View>

        <SectionHeader title="Navigation" meta="Persistent destinations" />
        <View style={styles.navigationPreview}>
          {[
            ['calendar', 'Dashboard'],
            ['layers', 'Plans'],
            ['time', 'History'],
            ['ellipsis-horizontal', 'More'],
          ].map(([icon, label]) => (
            <NavigationItem
              key={label}
              icon={icon}
              label={label}
              active={selectedNavigation === label}
              onPress={() => setSelectedNavigation(label)}
            />
          ))}
        </View>

        <SectionHeader title="Structure" meta="Quiet hierarchy" />
        <View style={styles.structureSample}>
          <Text style={styles.sampleTitle}>Recent context</Text>
          <Text style={styles.sampleMeta}>This month</Text>
          <Divider />
          <Text style={styles.sampleBody}>Separators and spacing carry most of the hierarchy.</Text>
        </View>

        <SectionHeader title="Application navigation" meta="Existing composition" />
        <View style={styles.bottomNavigationPreview}>
          <BottomNavigation />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screen, paddingBottom: 40 },
  eyebrow: { color: colors.slate, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginTop: 8 },
  intro: { color: colors.slate, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 520 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  navigationPreview: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider },
  structureSample: { paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider },
  sampleTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  sampleMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  sampleBody: { color: colors.slate, fontSize: 14, lineHeight: 20, marginTop: 12 },
  bottomNavigationPreview: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider },
});
