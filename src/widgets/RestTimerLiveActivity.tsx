import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type RestTimerLiveActivityProps = {
  startedAt: number;
  endAt: number;
  overdue: boolean;
};

const overdueColor = '#D64848';
const normalColor = '#FFFFFF';

function timerInterval(endAt: number, overdue: boolean) {
  const end = new Date(endAt);
  return overdue
    ? { lower: end, upper: new Date(endAt + 60 * 60 * 1000) }
    : { lower: new Date(Math.min(Date.now(), endAt)), upper: end };
}

function RestTimerValue({ endAt, overdue, size }: Pick<RestTimerLiveActivityProps, 'endAt' | 'overdue'> & { size: number }) {
  return (
    <Text
      timerInterval={timerInterval(endAt, overdue)}
      countsDown={!overdue}
      modifiers={[
        font({ size, weight: 'semibold', design: 'monospaced' }),
        monospacedDigit(),
        foregroundStyle(overdue ? overdueColor : normalColor),
      ]}
    />
  );
}

const RestTimerLiveActivityLayout = (
  props: RestTimerLiveActivityProps,
  environment: LiveActivityEnvironment,
) => {
  'widget';
  // `isStale` flips without JavaScript running, providing the overdue red
  // fallback when iOS has suspended the app at the exact end timestamp.
  const overdue = props.overdue || Boolean(environment.isStale);
  const title = overdue ? 'Rest overdue' : 'Rest';
  const color = overdue ? overdueColor : normalColor;

  return {
    banner: (
      <HStack
        spacing={12}
        modifiers={[padding({ all: 16 }), activityBackgroundTint('#13171B')]}
      >
        <VStack spacing={3}>
          <Text modifiers={[font({ size: 18, weight: 'semibold' }), foregroundStyle(color)]}>{title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#D4D8DC')]}>Forge rest timer</Text>
        </VStack>
        <Spacer />
        <RestTimerValue endAt={props.endAt} overdue={overdue} size={38} />
      </HStack>
    ),
    compactLeading: <Image systemName="timer" size={16} color={color} />,
    compactTrailing: <RestTimerValue endAt={props.endAt} overdue={overdue} size={14} />,
    minimal: <Image systemName="timer" size={15} color={color} />,
    expandedCenter: (
      <HStack spacing={8}>
        <Image systemName="timer" size={20} color={color} />
        <RestTimerValue endAt={props.endAt} overdue={overdue} size={28} />
      </HStack>
    ),
    expandedBottom: <Text modifiers={[font({ size: 13 }), foregroundStyle(color)]}>{title}</Text>,
  };
};

export const ForgeRestTimerLiveActivity = createLiveActivity(
  'ForgeRestTimerActivity',
  RestTimerLiveActivityLayout,
);
