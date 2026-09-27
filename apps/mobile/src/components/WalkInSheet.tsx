import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';
import { TextField } from './TextField';

export interface WalkInSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (seatCount: number, label: string) => void;
  isLoading?: boolean;
  maxSeats?: number;
}

export function WalkInSheet({ visible, onClose, onAdd, isLoading = false, maxSeats = 4 }: WalkInSheetProps) {
  const { t } = useTranslation();
  const [seatCount, setSeatCount] = useState(1);
  const [label, setLabel] = useState('');

  // Reset state when sheet opens.
  useEffect(() => {
    if (visible) {
      setSeatCount(1);
      setLabel('');
    }
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('trip.addWalkIn')}>
      <View style={styles.content}>
        <Stepper value={seatCount} min={1} max={maxSeats} onChange={setSeatCount} label={t('trip.walkInSeats')} />
        <TextField
          label={t('trip.walkInLabel')}
          placeholder={t('trip.walkInPlaceholder')}
          value={label}
          onChangeText={setLabel}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <Button
          label={t('trip.addWalkInConfirm')}
          variant="primary"
          icon="account-plus"
          onPress={() => onAdd(seatCount, label.trim())}
          loading={isLoading}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
});
