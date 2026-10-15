import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { filterStops } from './stopSearch';

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
  const [query, setQuery] = useState('');
  const selected = stops.find((s) => s.id === selectedId);
  const matches = filterStops(stops, query);

  function close() {
    setOpen(false);
    setQuery('');
  }

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

      <Sheet visible={open} onClose={close} title={label}>
        <View style={styles.search}>
          <Icon name="magnify" color={colors.ink400} size={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search stops"
            placeholderTextColor={colors.ink400}
            accessibilityLabel={`Search ${label} stops`}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12}>
              <Icon name="close-circle" color={colors.ink400} size={18} />
            </Pressable>
          ) : null}
        </View>
        <FlatList
          data={matches}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText variant="body" color={colors.ink500} align="center" style={styles.empty}>
              No stops match “{query.trim()}”
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item.id);
                close();
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink900, paddingVertical: spacing.sm },
  empty: { paddingVertical: spacing.lg },
});
