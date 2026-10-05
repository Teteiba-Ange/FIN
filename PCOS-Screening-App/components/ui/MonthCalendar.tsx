/**
 * MonthCalendar — a month grid for logging and reading cycle history.
 *
 * The cycle tracker previously had no calendar at all: two date buttons, a
 * picker, and five entries printed as text. For a cycle tracker the calendar
 * *is* the product — it is the only view where "my periods are irregular"
 * stops being a feeling and becomes something you can see.
 *
 * Encoding, deliberately not colour alone:
 *
 *   logged period   filled, in the accent          — recorded fact
 *   predicted       dashed outline, no fill        — an estimate
 *   today           ring
 *   selected        thick border
 *
 * A filled cell and an outlined cell differ in shape as well as hue, so the
 * distinction between "this happened" and "this might" survives greyscale and
 * colour-blindness. That distinction is the whole point of the view.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, minTouchTarget, radius, spacing } from "@/theme";
import { dateKey } from "@/lib/cycle/analysis";
import { Text } from "./Text";

type MonthCalendarProps = {
  /** Any date within the month to display. */
  month: Date;
  onMonthChange: (next: Date) => void;
  /** `YYYY-MM-DD` keys of days a period was logged. */
  periodDays: Set<string>;
  /** `YYYY-MM-DD` keys of the predicted window. */
  predictedDays?: Set<string>;
  selected?: Date | null;
  onSelectDay?: (date: Date) => void;
  style?: StyleProp<ViewStyle>;
};

/** Sunday-first, matching the default `Date.getDay()` numbering. */
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function MonthCalendar({
  month,
  onMonthChange,
  periodDays,
  predictedDays,
  selected,
  onSelectDay,
  style,
}: MonthCalendarProps) {
  const { colors } = useTheme();

  const today = new Date();
  const todayKey = dateKey(today);
  const selectedKey = selected ? dateKey(selected) : null;

  const { cells, monthLabel, isCurrentMonth } = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leading = first.getDay();

    const list: (Date | null)[] = [];
    for (let i = 0; i < leading; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, monthIndex, d));
    // Pad to whole weeks so the grid doesn't reflow as months change length.
    while (list.length % 7 !== 0) list.push(null);

    return {
      cells: list,
      monthLabel: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      isCurrentMonth:
        year === today.getFullYear() && monthIndex === today.getMonth(),
    };
    // `today` is stable for a render pass; recomputing per day is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const shift = (delta: number) =>
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  // A future month has nothing to log, so forward navigation stops at today.
  const canGoForward =
    new Date(month.getFullYear(), month.getMonth(), 1) <
    new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <View style={style}>
      <View style={styles.header}>
        <Pressable
          onPress={() => shift(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={spacing.sm}
          style={({ pressed }) => [
            styles.navButton,
            pressed && { backgroundColor: colors.sunken },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <Text variant="subhead" accessibilityRole="header" style={styles.monthLabel}>
          {monthLabel}
        </Text>

        <Pressable
          onPress={() => canGoForward && shift(1)}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoForward }}
          hitSlop={spacing.sm}
          style={({ pressed }) => [
            styles.navButton,
            pressed && canGoForward && { backgroundColor: colors.sunken },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={canGoForward ? colors.textPrimary : colors.textTertiary}
          />
        </Pressable>
      </View>

      <View
        style={styles.weekdays}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="caption" color="textTertiary" center style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) return <View key={`pad-${index}`} style={styles.cell} />;

          const key = dateKey(date);
          const isPeriod = periodDays.has(key);
          const isPredicted = !isPeriod && Boolean(predictedDays?.has(key));
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const isFuture = date > today;

          const label = date.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          const state = isPeriod
            ? "period logged"
            : isPredicted
              ? "period predicted"
              : "nothing logged";

          return (
            <Pressable
              key={key}
              onPress={() => !isFuture && onSelectDay?.(date)}
              disabled={isFuture || !onSelectDay}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${state}${isToday ? ", today" : ""}`}
              accessibilityState={{ selected: isSelected, disabled: isFuture }}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  isPeriod && { backgroundColor: colors.primary },
                  isPredicted && {
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.primary,
                  },
                  isToday && !isPeriod && { backgroundColor: colors.sunken },
                  isSelected && {
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor: colors.textPrimary,
                  },
                ]}
              >
                <Text
                  variant="callout"
                  numeric
                  style={{
                    color: isPeriod
                      ? colors.onPrimary
                      : isFuture
                        ? colors.textTertiary
                        : colors.textPrimary,
                    fontWeight: isToday ? "700" : "400",
                  }}
                >
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Without this the two cell styles are just decoration. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text variant="caption" color="textSecondary">
            Logged
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.swatch,
              { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primary },
            ]}
          />
          <Text variant="caption" color="textSecondary">
            Predicted
          </Text>
        </View>
        {isCurrentMonth && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.sunken }]} />
            <Text variant="caption" color="textSecondary">
              Today
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  navButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: minTouchTarget / 2,
  },
  monthLabel: { flex: 1, textAlign: "center" },

  weekdays: { flexDirection: "row", marginBottom: spacing.xs },
  weekday: { flex: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  // Seven per row, sized by percentage so the grid fits any screen width.
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  day: {
    width: "100%",
    height: "100%",
    maxWidth: 42,
    maxHeight: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
});
