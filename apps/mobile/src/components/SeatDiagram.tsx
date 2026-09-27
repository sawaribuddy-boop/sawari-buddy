import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, radius, spacing } from '@/theme';

interface SeatDiagramProps {
  capacity: number;
  occupiedSeats: number;
  selectedSeats?: number;
  onSelectSeats?: (count: number) => void;
  maxSelectable?: number;
  readOnly?: boolean;
}

function getSeatLayout(capacity: number): number[][] {
  switch (capacity) {
    case 3: return [[2], [1]];
    case 4: return [[2], [2]];
    case 5: return [[3], [2]];
    case 6: return [[3], [3]];
    case 7: return [[3], [2], [2]];
    case 8: return [[3], [3], [2]];
    default: return [[Math.min(capacity, 3)], [Math.max(capacity - 3, 0)]].filter(r => r[0]! > 0);
  }
}

export function SeatDiagram({
  capacity,
  occupiedSeats,
  selectedSeats = 0,
  onSelectSeats,
  maxSelectable = 4,
  readOnly = false,
}: SeatDiagramProps) {
  const { t } = useTranslation();
  const layout = getSeatLayout(capacity);
  let seatIndex = 0;

  const [selected, setSelected] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    let count = 0;
    for (let i = 0; i < capacity && count < selectedSeats; i++) {
      if (i >= occupiedSeats) {
        initial.add(i);
        count++;
      }
    }
    return initial;
  });

  const onSelectRef = useRef(onSelectSeats);
  onSelectRef.current = onSelectSeats;

  useEffect(() => {
    if (selected.size !== selectedSeats) {
      onSelectRef.current?.(selected.size);
    }
  }, [selected.size, selectedSeats]);

  const maxReached = selected.size >= maxSelectable;

  const handleSeatPress = useCallback((index: number) => {
    if (readOnly || !onSelectRef.current) return;
    if (index < occupiedSeats) return;

    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < maxSelectable) {
        next.add(index);
      }
      return next;
    });
  }, [readOnly, occupiedSeats, maxSelectable]);

  return (
    <View style={styles.container}>
      {layout.map((row, rowIdx) => {
        const rowSeats = row[0]!;
        const rowElements = [];
        for (let i = 0; i < rowSeats; i++) {
          const idx = seatIndex++;
          const isOccupied = idx < occupiedSeats;
          const isSelected = selected.has(idx);
          const isAvailable = !isOccupied && !isSelected;
          const isDisabled = readOnly || isOccupied || (isAvailable && maxReached);

          rowElements.push(
            <Pressable
              key={`seat-${idx}`}
              onPress={() => handleSeatPress(idx)}
              disabled={isDisabled}
              style={[
                styles.seat,
                isOccupied && styles.seatOccupied,
                isSelected && styles.seatSelected,
                isAvailable && !maxReached && styles.seatAvailable,
                isAvailable && maxReached && styles.seatDisabled,
              ]}
            >
              {isOccupied ? (
                <>
                  <Icon name="seat-passenger" size={22} color="#9CA3AF" />
                  <AppText variant="caption" color="#9CA3AF">{t('seatDiagram.booked')}</AppText>
                </>
              ) : (
                <>
                  <Icon
                    name={isSelected ? 'account-check' : 'account-outline'}
                    size={22}
                    color={isSelected ? colors.white : isDisabled ? colors.ink300 : colors.ink500}
                  />
                  <AppText
                    variant="caption"
                    color={isSelected ? colors.white : isDisabled ? colors.ink300 : colors.ink500}
                  >
                    {idx + 1}
                  </AppText>
                </>
              )}
            </Pressable>,
          );
        }
        return (
          <View key={`row-${rowIdx}`} style={styles.row}>
            {rowElements}
          </View>
        );
      })}

      {/* Driver row */}
      <View style={styles.row}>
        <View style={[styles.seat, styles.seatDriver]}>
          <Icon name="steering" size={22} color={colors.green700} />
          <AppText variant="caption" color={colors.green700}>D</AppText>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.ink300 }]} />
          <AppText variant="caption" color={colors.ink500}>{t('seatDiagram.booked')}</AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.green600 }]} />
          <AppText variant="caption" color={colors.ink500}>{t('seatDiagram.selected')}</AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }]} />
          <AppText variant="caption" color={colors.ink500}>{t('seatDiagram.available')}</AppText>
        </View>
      </View>
    </View>
  );
}

const SEAT_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  seat: {
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  seatAvailable: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  seatOccupied: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
    opacity: 0.8,
  },
  seatSelected: {
    backgroundColor: colors.green600,
    borderColor: colors.green700,
  },
  seatDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  seatDriver: {
    backgroundColor: colors.green50,
    borderColor: colors.green100,
    borderStyle: 'dashed',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
