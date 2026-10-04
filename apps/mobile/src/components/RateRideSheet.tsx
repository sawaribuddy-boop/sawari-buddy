import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Banner } from './Banner';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { StarRating } from './StarRating';
import { TextField } from './TextField';

export interface RateRideSheetProps {
  visible: boolean;
  /** "Not now" or tap outside. */
  onClose: () => void;
  onSubmit: (stars: number, comment: string) => void;
  origin: string;
  destination: string;
  driverFirstName: string;
  isLoading?: boolean;
  error?: string;
}

const STAR_LABEL = ['', 'Poor', 'Below average', 'Okay', 'Good', 'Excellent'] as const;
const COMMENT_MAX = 500;

export function RateRideSheet({
  visible,
  onClose,
  onSubmit,
  origin,
  destination,
  driverFirstName,
  isLoading = false,
  error,
}: RateRideSheetProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  // Reset state when sheet opens.
  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment('');
    }
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="How was your ride?">
      <View style={styles.content}>
        <View style={styles.route}>
          <AppText variant="bodyStrong">{origin}</AppText>
          <Icon name="arrow-right" color={colors.ink400} size={14} />
          <AppText variant="bodyStrong">{destination}</AppText>
        </View>
        {driverFirstName ? (
          <AppText variant="small" color={colors.ink500}>
            with {driverFirstName}
          </AppText>
        ) : null}

        <StarRating value={stars} onChange={setStars} size={40} />
        <AppText variant="small" color={colors.ink500} style={styles.center}>
          {stars ? STAR_LABEL[stars] : 'Tap a star to rate'}
        </AppText>

        <TextField
          label="Comment (optional)"
          placeholder="Anything the driver did well, or could do better?"
          value={comment}
          onChangeText={setComment}
          maxLength={COMMENT_MAX}
          multiline
          returnKeyType="done"
        />

        {error ? <Banner tone="danger" title={error} /> : null}

        <Button
          label="Submit rating"
          variant="primary"
          icon="star"
          disabled={stars === 0}
          loading={isLoading}
          onPress={() => onSubmit(stars, comment.trim())}
        />
        <Button label="Not now" variant="ghost" onPress={onClose} disabled={isLoading} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  center: { textAlign: 'center' },
});
