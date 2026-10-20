import { ForgeEntityName } from './ForgeEntityName';
import { ForgePressable as Pressable } from './ForgePressable';
import { ForgeSheetScrollView } from './ForgeSheetScrollView';
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IconName } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeText as Text } from './ForgeText';
import { HeaderAction } from './HeaderAction';
import { Icon } from './Icon';
import { errorHaptic, selectionHaptic } from './haptics';
import { pressedFeedback } from './pressFeedback';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { ForgeCard } from './ForgeCard';

export interface ForgeActionSheetAction {
  label: string;
  /** A concise explanation for a consequential source or choice. */
  description?: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'neutral' | 'destructive';
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * Keeps this sheet mounted for an internal destination, such as a compact
   * editor that replaces the action list. Most actions keep the default close.
   */
  dismiss?: boolean;
}

export interface ForgeActionSheetSection {
  title: string;
  layout?: 'tiles' | 'list';
  actions: readonly ForgeActionSheetAction[];
}

interface ForgeActionSheetProps {
  visible: boolean;
  overlay?: ReactNode;
  onBackRequest?: () => boolean;
  dragEnabled?: boolean;
  onClose: () => void;
  /** Fires one frame after the sheet has fully dismissed; see ForgeBottomSheet. */
  onClosed?: () => void;
  accessibilityLabel: string;
  title: string;
  contextName?: string;
  titleNumberOfLines?: number;
  /** Gives a contextual choice enough visual hierarchy to stand apart from the backdrop. */
  emphasis?: 'default' | 'prominent';
  appearance?: 'default' | 'compact';
  description?: string;
  backdropIntensity?: 'default' | 'strong';
  actions: readonly ForgeActionSheetAction[];
  sections?: readonly ForgeActionSheetSection[];
  sectionPresentation?: 'grouped' | 'flat';
  testID?: string;
  initialOffset?: number;
  closeDistance?: number;
  dismissThreshold?: number;
  /** Replaces the action list without dismissing and re-presenting a new sheet. */
  replacement?: ((close: () => void) => ReactNode) | null;
  /** Wait for a required initial action card to be laid out before entry. */
  waitForContentLayoutBeforeEnter?: boolean;
  /** Present the next entrance already open (restore after a screen push). */
  enterInstant?: boolean;
  /**
   * Ease the surface height when the body swaps between views. Defaults on
   * (except when measuring before entry). Turn off for multi-view sheets whose
   * views differ a lot in height: the Reanimated `layout` transition can fail to
   * shrink the surface back on a native Modal, leaving dead space under a
   * shorter view.
   */
  animateContentLayout?: boolean;
}

/** Shared Forge presentation for bottom-attached action lists. */
export function ForgeActionSheet({
  visible,
  overlay,
  onBackRequest,
  dragEnabled,
  onClose,
  onClosed,
  accessibilityLabel,
  title,
  contextName,
  titleNumberOfLines,
  emphasis = 'default',
  appearance = 'default',
  description,
  backdropIntensity,
  actions,
  sections,
  sectionPresentation = 'grouped',
  testID,
  initialOffset,
  closeDistance,
  dismissThreshold,
  replacement = null,
  waitForContentLayoutBeforeEnter = false,
  enterInstant = false,
  animateContentLayout,
}: ForgeActionSheetProps) {
  const theme = useForgeTheme();
  const grouped = sections && sectionPresentation === 'grouped';
  const neutralActions = [...actions, ...(!grouped ? sections?.flatMap(section => section.actions) ?? [] : [])]
    .filter((action) => (action.tone ?? 'neutral') === 'neutral');
  const destructiveActions = [...actions, ...(sections?.flatMap((section) => section.actions) ?? [])]
    .filter((action) => action.tone === 'destructive');
  const headerDestructiveAction = destructiveActions[0];

  return (
    <ForgeBottomSheet
      visible={visible}
      overlay={overlay}
      onBackRequest={onBackRequest}
      dragEnabled={dragEnabled}
      onClose={onClose}
      onClosed={onClosed}
      accessibilityLabel={accessibilityLabel}
      surfaceTestID={testID}
      initialOffset={initialOffset}
      closeDistance={closeDistance}
      dismissThreshold={dismissThreshold}
      backdropIntensity={backdropIntensity}
      enterInstant={enterInstant}
      waitForContentLayoutBeforeEnter={waitForContentLayoutBeforeEnter}
      // Ease the sheet height when the body swaps between the action list and a
      // replacement view (note / info / history / rest). Skipped for sheets that
      // measure before entering, whose post-mount measurement would otherwise
      // animate on open, or when a caller opts out (views too different in height
      // for the Modal's layout transition to shrink back reliably).
      animateContentLayout={animateContentLayout ?? !waitForContentLayoutBeforeEnter}
    >
      {(close) => (
        // A replacement view renders as a direct child of the sheet surface (no
        // wrapping View) so a scroll body inside it can bound against the
        // surface's maxHeight and actually scroll — per ADR 0005, a scroll view
        // nested under hugging wrappers never gets a definite height and clips.
        replacement ? replacement(close) : (
        <View style={[styles.sheet, emphasis === 'prominent' && styles.prominentSheet]}>
            <ForgeBottomSheetHandle />
            <ForgeSheetHeader
              title={title}
              compactTitle={!!sections && !grouped}
              titleInset={grouped ? scaleUI(52) : undefined}
              titleNumberOfLines={titleNumberOfLines}
              onClose={close}
              closePosition={headerDestructiveAction ? 'left' : 'right'}
              trailing={
                headerDestructiveAction ? (
                  <HeaderAction
                    accessibilityLabel={headerDestructiveAction.accessibilityLabel ?? headerDestructiveAction.label}
                    icon={headerDestructiveAction.icon}
                    iconOnly
                    tone="destructive"
                    haptic="none"
                    disabled={headerDestructiveAction.disabled}
                    onPress={() => {
                      // Run the handler before dismissing (matching the action rows below);
                      // closing first can drop a chained follow-up (e.g. a confirmation modal).
                      errorHaptic();
                      headerDestructiveAction.onPress();
                      close();
                    }}
                  />
                ) : undefined
              }
            />
            {description ? (
              <View
                style={[
                  styles.descriptionCard,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
              </View>
            ) : null}
            {grouped ? (
              <ForgeSheetScrollView style={styles.sectionScroll} contentContainerStyle={styles.sections}>
                {contextName ? <ForgeEntityName style={[styles.contextName, { color: theme.textSecondary }]}>{contextName}</ForgeEntityName> : null}
                {sections.filter((section) => section.actions.some((action) => action.tone !== 'destructive')).map((section) => {
                  const items = section.actions.filter((action) => action.tone !== 'destructive');
                  return (
                    <View key={section.title} testID={`action-section-${section.title}`} style={styles.section}>
                      <Text accessibilityRole="header" style={[typeScale.sectionTitle, { color: theme.textPrimary }]}>{section.title}</Text>
                      {section.layout === 'tiles' ? (
                        <View style={styles.tiles}>
                          {items.map((action) => <ForgeCard key={action.label} variant="nested" size="compact" style={styles.tileCard}>
                            <ActionRow action={action} close={close} tile />
                          </ForgeCard>)}
                        </View>
                      ) : (
                        <ForgeCard variant="nested" size="compact">
                          {items.map((action, index) => <ActionRow key={action.label} action={action} close={close} compact grouped divider={index < items.length - 1} />)}
                        </ForgeCard>
                      )}
                    </View>
                  );
                })}
              </ForgeSheetScrollView>
            ) : neutralActions.length > 0 && (
              // Hug-then-scroll (ADR 0005): the list sizes to its rows but, when
              // there are more actions than fit (a long "Add tile" list on a short
              // phone), it scrolls within the sheet's capped height instead of
              // being clipped.
              <ForgeSheetScrollView
                style={[
                  styles.actionList,
                  emphasis === 'prominent' && styles.prominentActionList,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  appearance === 'compact' && styles.compactActionList,
                  appearance === 'compact' && { backgroundColor: theme.surfaceElevated },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
              {contextName ? <ForgeEntityName style={[typeScale.body, { color: theme.textPrimary, padding: scaleUI(16) }]}>{contextName}</ForgeEntityName> : null}
                {neutralActions.map((action, index) => (
                  <ActionRow
                    key={action.label}
                    action={action}
                    close={close}
                    divider={index < neutralActions.length - 1}
                    compact={appearance === 'compact' || !!sections}
                  />
                ))}
              </ForgeSheetScrollView>
            )}
            {destructiveActions.length > 1 && (
              <View
                style={[
                  styles.destructiveList,
                  { borderColor: theme.textDestructive, backgroundColor: theme.destructiveSurface },
                ]}
              >
                {destructiveActions.slice(1).map((action) => (
                  <ActionRow key={action.label} action={action} close={close} />
                ))}
              </View>
            )}
        </View>
        )
      )}
    </ForgeBottomSheet>
  );
}

function ActionRow({
  action,
  close,
  divider = false,
  compact = false,
  grouped = false,
  tile = false,
}: {
  action: ForgeActionSheetAction;
  close: () => void;
  divider?: boolean;
  compact?: boolean;
  grouped?: boolean;
  tile?: boolean;
}) {
  const theme = useForgeTheme();
  const destructive = action.tone === 'destructive';
  const color = destructive ? theme.textDestructive : theme.textPrimary;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel ?? action.label}
        accessibilityState={{ disabled: action.disabled }}
        disabled={action.disabled}
        onPress={() => {
          if (destructive) errorHaptic();
          else selectionHaptic();
          action.onPress();
          if (action.dismiss !== false) close();
        }}
      style={({ pressed }) => [
        styles.actionRow,
          compact && styles.compactActionRow,
          grouped && styles.groupedActionRow,
          tile && styles.tileAction,
          action.description && styles.descriptiveActionRow,
          destructive && styles.destructiveAction,
          action.disabled && styles.disabledAction,
          pressed && pressedFeedback,
        ]}
      >
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: destructive ? theme.destructiveSurfacePressed : theme.surfaceMuted,
              borderColor: destructive ? theme.textDestructive : theme.border,
            },
            (compact || tile) && styles.compactIcon,
          ]}
        >
          <Icon name={action.icon} size={21} color={action.disabled ? theme.textDisabled : color} />
        </View>
        <View style={tile ? styles.tileCopy : styles.actionCopy}>
          <Text style={[styles.actionLabel, tile && styles.tileLabel, { color: action.disabled ? theme.textDisabled : color }]}>
            {action.label}
          </Text>
          {action.description ? (
            <Text style={[styles.actionDescription, { color: action.disabled ? theme.textDisabled : theme.textSecondary }]}>
              {action.description}
            </Text>
          ) : null}
        </View>
        {!tile && !grouped && <Icon
          name="chevron-forward"
          size={19}
          color={action.disabled ? theme.textDisabled : destructive ? theme.textDestructive : theme.textSecondary}
        />}
      </Pressable>
      {divider && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  // flexShrink + minHeight:0 let the action list bound against the sheet's capped
  // height so it can scroll (ADR 0005) instead of overflowing on short screens.
  sheet: { paddingBottom: scaleUI(30), flexShrink: 1, minHeight: 0 },
  prominentSheet: { paddingBottom: scaleUI(34) },
  sectionScroll: { flexGrow: 0, flexShrink: 1 },
  sections: { paddingHorizontal: scaleUI(20), gap: scaleUI(16), paddingTop: scaleUI(4), paddingBottom: scaleUI(4) },
  contextName: { ...typeScale.body, textAlign: 'center', marginBottom: scaleUI(2) },
  section: { gap: scaleUI(8) },
  tiles: { flexDirection: 'row', alignItems: 'stretch', gap: scaleUI(8) },
  tileCard: { flex: 1, minWidth: 0 },
  tileAction: { minHeight: scaleUI(88), flexGrow: 1, paddingHorizontal: scaleUI(6), paddingVertical: scaleUI(12), flexDirection: 'column', justifyContent: 'center', gap: scaleUI(8) },
  tileCopy: { alignSelf: 'stretch' },
  tileLabel: { textAlign: 'center' },
  groupedActionRow: { minHeight: Math.max(44, scaleUI(48)), borderRadius: 0, paddingVertical: scaleUI(10) },
  descriptionCard: {
    marginHorizontal: scaleUI(20),
    marginTop: 4,
    paddingHorizontal: scaleUI(16),
    paddingVertical: scaleUI(13),
    borderWidth: 1,
    borderRadius: scaleUI(16),
  },
  description: { ...typeScale.body },
  actionList: {
    marginHorizontal: scaleUI(20),
    // Keep the compact list close to the title after removing the contextual card.
    // This changes its position, not the row density.
    marginTop: 4,
    // Hug the rows, but shrink (and scroll) when they exceed the sheet's cap.
    flexGrow: 0,
    flexShrink: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: scaleUI(16),
  },
  prominentActionList: { marginTop: scaleUI(12) },
  compactActionList: { borderWidth: 0, paddingHorizontal: scaleUI(4), borderRadius: scaleUI(18) },
  compactActionRow: { minHeight: Math.max(44, scaleUI(56)), borderRadius: scaleUI(14) },
  compactIcon: { backgroundColor: 'transparent', borderWidth: 0, width: scaleUI(30), height: scaleUI(30) },
  destructiveList: {
    marginHorizontal: scaleUI(20),
    marginTop: scaleUI(14),
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: scaleUI(16),
  },
  actionRow: {
    minHeight: Math.max(44, scaleUI(62)),
    paddingHorizontal: scaleUI(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleUI(12),
  },
  descriptiveActionRow: { minHeight: Math.max(44, scaleUI(76)), paddingVertical: scaleUI(11) },
  destructiveAction: { minHeight: Math.max(44, scaleUI(64)) },
  disabledAction: { opacity: 0.68 },
  actionCopy: { flex: 1, gap: 2 },
  actionLabel: { ...typeScale.controlLabel },
  actionDescription: { ...typeScale.caption },
  iconTile: {
    width: scaleUI(38),
    height: scaleUI(38),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: scaleUI(11),
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: scaleUI(62) },
});
