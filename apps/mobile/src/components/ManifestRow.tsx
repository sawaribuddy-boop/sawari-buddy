import { BOOKING_SOURCE, type BookingSource, BOOKING_STATUS, type BookingStatus } from '@sawari/constants';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { NoShowCountdown } from './NoShowCountdown';
import type { PillTone } from './StatusPill';
import { StatusPill } from './StatusPill';

export interface ManifestRowProps {
  code: string;
  seatCount: number;
  status: string;
  source: string;
  walkInLabel?: string | null;
  passengerName?: string | null;
  seatPreference?: string | null;
  noShowEligibleAt?: string | null;
  onMarkBoarded?: () => void;
  onMarkNoShow?: () => void;
  onRemoveWalkIn?: () => void;
  isActionLoading?: boolean;
}

const STATUS_TONE: Record<string, PillTone> = {
  [BOOKING_STATUS.CONFIRMED]: 'success',
  [BOOKING_STATUS.BOARDED]: 'info',
  [BOOKING_STATUS.COMPLETED]: 'neutral',
  [BOOKING_STATUS.CANCELLED]: 'danger',
  [BOOKING_STATUS.NO_SHOW]: 'warning',
};

const STATUS_LABEL: Record<string, string> = {
  [BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [BOOKING_STATUS.BOARDED]: 'Boarded',
  [BOOKING_STATUS.COMPLETED]: 'Completed',
  [BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [BOOKING_STATUS.NO_SHOW]: 'No Show',
};

function isNoShowEligible(eligibleAt: string | null | undefined): boolean {
  if (!eligibleAt) return false;
  return new Date(eligibleAt).getTime() <= Date.now();
}

export function ManifestRow({
  code,
  seatCount,
  status,
  source,
  walkInLabel,
  passengerName,
  seatPreference,
  noShowEligibleAt,
  onMarkBoarded,
  onMarkNoShow,
  onRemoveWalkIn,
  isActionLoading = false,
}: ManifestRowProps) {
  const isApp = source === BOOKING_SOURCE.APP;
  const isWalkIn = source === BOOKING_SOURCE.WALK_IN;
  const displayName = isApp ? passengerName : (walkInLabel ?? 'Walk-in');
  const sourceBadge = isApp ? 'APP' : 'WALK-IN';

  return (
    <Card>
      <View style={styles.topRow}>
        <View style={styles.codeRow}>
          <AppText variant="bodyStrong">#{code}</AppText>
          <View style={[styles.sourceBadge, isWalkIn && styles.sourceBadgeWalkIn]}>
            <AppText variant="caption" color={isWalkIn ? colors.warning : colors.info}>
              {sourceBadge}
            </AppText>
          </View>
        </View>
        <StatusPill label={STATUS_LABEL[status] ?? status} tone={STATUS_TONE[status] ?? 'neutral'} />
      </View>

      <View style={styles.details}>
        {displayName ? (
          <View style={styles.detailRow}>
            <Icon name="account" color={colors.ink500} size={16} />
            <AppText variant="small" color={colors.ink700}>{displayName}</AppText>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Icon name="seat" color={colors.ink500} size={16} />
          <AppText variant="small" color={colors.ink700}>
            {seatCount} {seatCount === 1 ? 'seat' : 'seats'}
            {seatPreference ? ` · ${seatPreference}` : ''}
          </AppText>
        </View>
      </View>

      {status === BOOKING_STATUS.CONFIRMED && onMarkBoarded ? (
        <Button
          label="Mark Boarded"
          variant="primary"
          size="md"
          icon="check"
          onPress={onMarkBoarded}
          loading={isActionLoading}
        />
      ) : null}

      {status === BOOKING_STATUS.BOARDED && isApp && noShowEligibleAt ? (
        isNoShowEligible(noShowEligibleAt) ? (
          onMarkNoShow ? (
            <Button
              label="No-show"
              variant="dangerSoft"
              size="md"
              icon="account-remove"
              onPress={onMarkNoShow}
              loading={isActionLoading}
            />
          ) : null
        ) : (
          <NoShowCountdown eligibleAt={noShowEligibleAt} />
        )
      ) : null}

      {status === BOOKING_STATUS.BOARDED && isWalkIn && onRemoveWalkIn ? (
        <Button
          label="Remove"
          variant="dangerSoft"
          size="md"
          icon="close"
          onPress={onRemoveWalkIn}
          loading={isActionLoading}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceBadge: {
    backgroundColor: colors.infoSoft,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  sourceBadgeWalkIn: { backgroundColor: colors.warningSoft },
  details: { gap: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
