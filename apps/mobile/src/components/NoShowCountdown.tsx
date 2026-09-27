import { useEffect, useState } from 'react';
import { secondsUntil } from '@sawari/domain';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface NoShowCountdownProps {
  eligibleAt: string;
}

// Shows time remaining until no-show marking is eligible.
export function NoShowCountdown({ eligibleAt }: NoShowCountdownProps) {
  const [remaining, setRemaining] = useState(() => secondsUntil(eligibleAt));

  useEffect(() => {
    setRemaining(secondsUntil(eligibleAt));
    const id = setInterval(() => {
      const s = secondsUntil(eligibleAt);
      setRemaining(s);
      if (s <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [eligibleAt]);

  if (remaining <= 0) return null;

  return (
    <View style={styles.row}>
      <Icon name="timer-sand" color={colors.warning} size={14} />
      <AppText variant="caption" color={colors.warning}>
        No-show in {remaining}s
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
});
