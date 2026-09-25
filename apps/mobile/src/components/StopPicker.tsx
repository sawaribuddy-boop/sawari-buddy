import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface Stop {
  id: string;
  name: string;
}

export interface StopPickerProps {
  label: string;
  stops: Stop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StopPicker({ label, stops, selectedId, onSelect }: StopPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = stops.find((s) => s.id === selectedId);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name ?? 'not selected'}`}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <AppText variant="caption" color={colors.ink500}>
          {label}
        </AppText>
        <View style={styles.valueRow}>
          <AppText variant="body" color={selected ? colors.ink900 : colors.ink400} style={styles.valueText}>
            {selected?.name ?? 'Select stop'}
          </AppText>
          <Icon name="chevron-down" color={colors.ink400} size={20} />
        </View>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <FlatList
          data={stops}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item.id);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            >
              <AppText variant="body" color={item.id === selectedId ? colors.green700 : colors.ink900}>
                {item.name}
              </AppText>
              {item.id === selectedId ? <Icon name="check" color={colors.green700} size={20} /> : null}
            </Pressable>
          )}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.green50 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxs },
  valueText: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  optionPressed: { backgroundColor: colors.green50 },
});
