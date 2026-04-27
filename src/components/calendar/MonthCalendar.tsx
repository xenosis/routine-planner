import React, { useEffect, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { borderRadius, spacing } from '../../theme';
import { toLocalDateStr } from '../../utils/date';

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

interface RangeBarInfo {
  color: string;
  roundLeft: boolean;
  roundRight: boolean;
}

interface MonthCalendarProps {
  selectedDate: string | null;
  markedDates: Record<string, string[]>;
  onDateSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
  rangeEvents?: { startDate: string; endDate: string; color: string }[];
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MonthCalendar({
  selectedDate,
  markedDates,
  onDateSelect,
  onMonthChange,
  rangeEvents,
}: MonthCalendarProps): React.JSX.Element {
  const theme = useTheme();
  const today = toLocalDateStr();

  const initial = selectedDate || toLocalDateStr();
  const [viewYear, setViewYear] = useState(() => parseInt(initial.split('-')[0], 10));
  const [viewMonth, setViewMonth] = useState(() => parseInt(initial.split('-')[1], 10));

  useEffect(() => {
    if (selectedDate !== null) {
      const y = parseInt(selectedDate.split('-')[0], 10);
      const m = parseInt(selectedDate.split('-')[1], 10);
      setViewYear(y);
      setViewMonth(m);
    }
  }, [selectedDate]);

  function goToPrevMonth() {
    let y = viewYear;
    let m = viewMonth - 1;
    if (m < 1) { m = 12; y -= 1; }
    setViewYear(y);
    setViewMonth(m);
    onMonthChange(y, m);
  }

  function goToNextMonth() {
    let y = viewYear;
    let m = viewMonth + 1;
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y);
    setViewMonth(m);
    onMonthChange(y, m);
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
        onPanResponderRelease: (_, gs) => {
          const isHorizontal = Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
          if (!isHorizontal) return;
          if (gs.dx < -SWIPE_THRESHOLD || gs.vx < -SWIPE_VELOCITY_THRESHOLD) {
            goToNextMonth();
          } else if (gs.dx > SWIPE_THRESHOLD || gs.vx > SWIPE_VELOCITY_THRESHOLD) {
            goToPrevMonth();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewYear, viewMonth],
  );

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
    const lastDate = new Date(viewYear, viewMonth, 0).getDate();
    const prevLastDate = new Date(viewYear, viewMonth - 1, 0).getDate();

    const result: Array<{ dateStr: string; day: number; isCurrent: boolean }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevLastDate - i;
      let y = viewYear; let m = viewMonth - 1;
      if (m < 1) { m = 12; y -= 1; }
      result.push({ dateStr: toDateString(y, m, d), day: d, isCurrent: false });
    }
    for (let d = 1; d <= lastDate; d++) {
      result.push({ dateStr: toDateString(viewYear, viewMonth, d), day: d, isCurrent: true });
    }
    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      let y = viewYear; let m = viewMonth + 1;
      if (m > 12) { m = 1; y += 1; }
      result.push({ dateStr: toDateString(y, m, d), day: d, isCurrent: false });
    }
    return result;
  }, [viewYear, viewMonth]);

  // 날짜별 range bar 정보 사전 계산
  const rangeBarMap = useMemo(() => {
    const map: Record<string, RangeBarInfo[]> = {};
    if (!rangeEvents || rangeEvents.length === 0) return map;

    for (const ev of rangeEvents) {
      const cur = new Date(ev.startDate + 'T00:00:00');
      const end = new Date(ev.endDate + 'T00:00:00');

      while (cur <= end) {
        const dateStr = toDateString(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
        const dow = cur.getDay();

        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({
          color: ev.color,
          roundLeft: dateStr === ev.startDate || dow === 0,
          roundRight: dateStr === ev.endDate || dow === 6,
        });

        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [rangeEvents]);

  const getDotColors = (dateStr: string): string[] => (markedDates[dateStr] ?? []).slice(0, 3);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      {...panResponder.panHandlers}
    >
      {/* 월 헤더 */}
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          size={20}
          iconColor={theme.colors.onSurface}
          onPress={goToPrevMonth}
          style={styles.headerBtn}
        />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          {viewYear}년 {viewMonth}월
        </Text>
        <IconButton
          icon="chevron-right"
          size={20}
          iconColor={theme.colors.onSurface}
          onPress={goToNextMonth}
          style={styles.headerBtn}
        />
      </View>

      {/* 요일 행 */}
      <View style={styles.weekRow}>
        {WEEK_DAYS.map((day, idx) => {
          const color = idx === 0 ? '#EF4444' : idx === 6 ? '#3B82F6' : theme.colors.onSurfaceVariant;
          return (
            <View key={day} style={styles.weekCell}>
              <Text style={[styles.weekText, { color }]}>{day}</Text>
            </View>
          );
        })}
      </View>

      {/* 날짜 그리드 */}
      <View style={styles.grid}>
        {cells.map((cell, index) => {
          const isToday = cell.dateStr === today;
          const isSelected = selectedDate !== null && cell.dateStr === selectedDate;
          const dotColors = cell.isCurrent ? getDotColors(cell.dateStr) : [];
          const bars = cell.isCurrent ? (rangeBarMap[cell.dateStr] ?? []).slice(0, 2) : [];
          const dow = index % 7;

          let textColor = theme.colors.onBackground;
          if (!cell.isCurrent) textColor = theme.colors.outline;
          else if (isToday) textColor = theme.colors.onPrimary;
          else if (isSelected) textColor = theme.colors.primary;
          else if (dow === 0) textColor = '#EF4444';
          else if (dow === 6) textColor = '#3B82F6';

          return (
            <TouchableOpacity
              key={cell.dateStr}
              style={styles.dayCell}
              onPress={() => onDateSelect(cell.dateStr)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.dayCircle,
                isToday && { backgroundColor: theme.colors.primary },
                isSelected && !isToday && { borderWidth: 1.5, borderColor: theme.colors.primary },
              ]}>
                <Text style={[
                  styles.dayText,
                  { color: textColor },
                  !cell.isCurrent && { opacity: 0.35 },
                ]}>
                  {cell.day}
                </Text>
              </View>

              {/* Range bars */}
              {bars.map((bar, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.rangeBar,
                    {
                      backgroundColor: bar.color + '55',
                      marginLeft: bar.roundLeft ? 3 : 0,
                      marginRight: bar.roundRight ? 3 : 0,
                      borderTopLeftRadius: bar.roundLeft ? 3 : 0,
                      borderBottomLeftRadius: bar.roundLeft ? 3 : 0,
                      borderTopRightRadius: bar.roundRight ? 3 : 0,
                      borderBottomRightRadius: bar.roundRight ? 3 : 0,
                      marginTop: idx === 0 ? 2 : 1,
                    },
                  ]}
                />
              ))}

              {dotColors.length > 0 && (
                <View style={styles.dotRow}>
                  {dotColors.map((color, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE = 36;

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  headerBtn: { margin: 0 },
  headerTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  weekText: { fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
    marginBottom: 2,
  },
  dayCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 13, fontWeight: '500' },
  rangeBar: {
    height: 5,
    alignSelf: 'stretch',
  },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
