import React, { useEffect, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { borderRadius, spacing } from '../../theme';

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

// 스와이프 감지 임계값
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

interface MonthCalendarProps {
  selectedDate: string | null;   // null = 날짜 미선택 상태
  markedDates: Record<string, number>;
  onDateSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayString(): string {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export default function MonthCalendar({
  selectedDate,
  markedDates,
  onDateSelect,
  onMonthChange,
}: MonthCalendarProps): React.JSX.Element {
  const theme = useTheme();
  const today = getTodayString();

  // 초기 뷰 연/월: selectedDate가 있으면 그 월, 없으면 오늘
  const initial = selectedDate || getTodayString();
  const [viewYear, setViewYear] = useState(() => parseInt(initial.split('-')[0], 10));
  const [viewMonth, setViewMonth] = useState(() => parseInt(initial.split('-')[1], 10));

  // selectedDate가 외부에서 변경되면 달력 뷰 월도 동기화
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

  // 스와이프 감지 PanResponder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // 수평 움직임이 주요 제스처일 때만 캡처
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

  // 캘린더 그리드 셀 계산
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

  // 날짜별 점 개수 (최대 3개)
  const getDotCount = (dateStr: string) => Math.min(markedDates[dateStr] ?? 0, 3);

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
          const dotCount = cell.isCurrent ? getDotCount(cell.dateStr) : 0;
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
              {dotCount > 0 && (
                <View style={styles.dotRow}>
                  {Array.from({ length: dotCount }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: theme.colors.primary }]}
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
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
