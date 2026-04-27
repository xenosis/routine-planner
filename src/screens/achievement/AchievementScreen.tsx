import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedButtons, Surface, Text, useTheme, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import { Calendar } from 'react-native-calendars';

import { initDatabase } from '../../db/database';
import {
  getDailyCompletions,
  getRoutineAchievements,
  getTotalRoutineCount,
  getTodayCompletedRoutineIds,
  getTotalCompletionCount,
  getEarliestRoutineCreatedAt,
  getRoutineScheduleInfo,
  getWeeklyCompletionsByRoutine,
  getRoutineCompletionsInRange,
  type RoutineAchievementRow,
  type RoutineScheduleInfo,
} from '../../db/achievementDb';
import { borderRadius, spacing } from '../../theme';
import {
  getDateBefore,
  getDayLabel,
  getWeekStart,
  getThisWeekDays,
  getScheduledCountForDate,
} from '../../utils/achievementCalc';
import { toLocalDateStr } from '../../utils/date';

// ─────────────────────────────────────────────
// 성과 데이터 타입
// ─────────────────────────────────────────────

interface AchievementData {
  /** 오늘 완료 루틴 수 */
  todayCompleted: number;
  /** 오늘 예정된 루틴 수 (daily + weekly_count + 오늘 요일에 해당하는 weekly_days) */
  todayScheduled: number;
  /** 전체 루틴 수 */
  totalRoutines: number;
  /** 이번 주 달성률 (0 ~ 100) */
  weeklyRate: number;
  /** 최고 스트릭 */
  maxStreak: number;
  /** 최고 스트릭 단위 ('일' | '주') */
  maxStreakUnit: string;
  /** 누적 완료 횟수 */
  totalCompletions: number;
  /** 주간 차트 데이터 (7일) */
  weeklyChartData: { label: string; value: number; scheduled: number; date: string }[];
  /** 루틴별 달성률 목록 */
  routineAchievements: RoutineAchievementRow[];
  /** 가장 오래된 루틴 생성일 */
  earliestRoutineDate: string;
  /** 날짜별 예정 루틴 계산용 스케줄 정보 */
  routineSchedules: RoutineScheduleInfo[];
}

// ─────────────────────────────────────────────
// 데이터 로딩 훅
// ─────────────────────────────────────────────

function useAchievementData() {
  const [data, setData] = useState<AchievementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await initDatabase();

      const today = toLocalDateStr();
      const thisWeekDays = getThisWeekDays(today);
      const weekStart = thisWeekDays[0];

      // 병렬로 데이터 조회
      const [
        todayCompletedIds,
        totalRoutines,
        totalCompletions,
        weeklyCompletions,
        weeklyRoutineCompletions,
        routineAchievements,
        earliestRoutineDate,
        routineSchedules,
      ] = await Promise.all([
        getTodayCompletedRoutineIds(today),
        getTotalRoutineCount(),
        getTotalCompletionCount(),
        getDailyCompletions(weekStart, today),
        getWeeklyCompletionsByRoutine(weekStart, today),
        getRoutineAchievements(today),
        getEarliestRoutineCreatedAt(today),
        getRoutineScheduleInfo(),
      ]);

      const weeklyDoneMap = new Map(weeklyRoutineCompletions.map((r) => [r.routineId, r.count]));

      // "오늘 이전에 이미 quota를 달성한" 루틴 ID 집합
      // 오늘 체크분(todayCompletedIds)을 제외한 횟수로 판단해야
      // 오늘 체크로 quota를 채운 경우는 "오늘 완료"로 정상 집계된다
      const quotaMetBeforeToday = new Set(
        routineSchedules
          .filter((r) => {
            if (r.frequency !== 'weekly_count') return false;
            const total = weeklyDoneMap.get(r.id) ?? 0;
            const todayCount = todayCompletedIds.includes(r.id) ? 1 : 0;
            return (total - todayCount) >= (r.weeklyCount ?? 1);
          })
          .map((r) => r.id),
      );

      // 오늘 예정된 루틴 수 (오늘 이전에 이미 quota 달성한 weekly_count 제외)
      const todayScheduled = getScheduledCountForDate(today, routineSchedules, quotaMetBeforeToday);

      // 오늘 완료 루틴 수 (오늘 이전 quota 달성 루틴 제외 → 분모와 일관성 유지)
      const todayCompleted = todayCompletedIds.filter((id) => !quotaMetBeforeToday.has(id)).length;

      // routineAchievements에서 최고 스트릭 루틴 도출 (단위 포함)
      const maxStreakRoutine = routineAchievements.reduce<typeof routineAchievements[number] | null>(
        (best, r) => (r.streak > (best?.streak ?? -1) ? r : best),
        null,
      );
      const maxStreak = maxStreakRoutine?.streak ?? 0;
      const maxStreakUnit = maxStreakRoutine?.frequency === 'weekly_count' ? '주' : '일';

      // 주간 차트: 각 날짜별로 "그날 예정된 루틴 수"를 분모로 사용
      // weekly_count 중 이번 주 quota 달성한 루틴은 분모에서 제외
      const quotaMetForWeek = new Set(
        routineSchedules
          .filter((r) => r.frequency === 'weekly_count' && (weeklyDoneMap.get(r.id) ?? 0) >= (r.weeklyCount ?? 1))
          .map((r) => r.id),
      );

      const completionMap = new Map<string, number>(
        weeklyCompletions.map((r) => [r.date, r.completedCount]),
      );
      const weeklyChartData = thisWeekDays.map((date) => {
        const completed = completionMap.get(date) ?? 0;
        const scheduled = getScheduledCountForDate(date, routineSchedules, quotaMetForWeek);
        const rate = scheduled > 0 ? Math.min(Math.round((completed / scheduled) * 100), 100) : 0;
        return {
          label: getDayLabel(date),
          value: rate,
          scheduled,
          date,
        };
      });

      // 주간 달성률: 루틴별로 계산 후 평균
      // - daily / weekly_days: 이번 주 예정 일수 대비 완료 일수
      // - weekly_count: min(완료횟수, quota) / quota
      // - weekly_days로 이번 주 아직 예정일 없는 루틴은 평균에서 제외 (기회 없음 → 0% 왜곡 방지)
      let weeklyRate = 0;
      const activeRoutines = routineSchedules.filter((r) => r.createdAt <= today);
      if (activeRoutines.length > 0) {
        const rates = activeRoutines
          .map((routine) => {
            const done = weeklyDoneMap.get(routine.id) ?? 0;
            if (routine.frequency === 'weekly_count') {
              const quota = routine.weeklyCount ?? 1;
              return Math.min(done / quota, 1);
            }
            const scheduledDays = thisWeekDays.filter((d) => {
              if (d < routine.createdAt) return false;
              const [y, mo, day] = d.split('-').map(Number);
              const weekday = new Date(y, mo - 1, day).getDay();
              if (routine.frequency === 'daily') return true;
              return routine.weekdays?.includes(weekday) ?? false;
            }).length;
            // 이번 주 아직 예정일 없는 weekly_days → 평균 계산에서 제외
            return scheduledDays > 0 ? Math.min(done / scheduledDays, 1) : null;
          })
          .filter((r): r is number => r !== null);
        if (rates.length > 0) {
          weeklyRate = Math.round(
            (rates.reduce((a, b) => a + b, 0) / rates.length) * 100,
          );
        }
      }

      setData({
        todayCompleted,
        todayScheduled,
        totalRoutines,
        weeklyRate,
        maxStreak,
        maxStreakUnit,
        totalCompletions,
        weeklyChartData,
        routineAchievements,
        earliestRoutineDate,
        routineSchedules,
      });
    } catch (e) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error('[AchievementScreen] 데이터 로딩 오류:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 탭에 포커스될 때마다 최신 데이터로 새로고침
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, loading, error, reload: load };
}

type MarkedDates = Record<string, { selected?: boolean; selectedColor?: string; dotColor?: string; marked?: boolean }>;

/** 월간 마킹 데이터를 생성하는 순수 함수 */
function buildMarkedDates(
  year: number,
  month: number,
  today: string,
  routineSchedules: RoutineScheduleInfo[],
  routineCompletions: { routineId: string; date: string }[],
  earliestRoutineDate: string,
): MarkedDates {
  // 날짜별 완료 루틴 ID 집합
  const completionsByDate = new Map<string, Set<string>>();
  // 주 시작일 → 루틴 ID → 해당 주 완료 날짜 목록 (quota 누적 계산용)
  const weekRoutineDates = new Map<string, Map<string, string[]>>();

  for (const { routineId, date } of routineCompletions) {
    if (!completionsByDate.has(date)) completionsByDate.set(date, new Set());
    completionsByDate.get(date)!.add(routineId);

    const ws = getWeekStart(date);
    if (!weekRoutineDates.has(ws)) weekRoutineDates.set(ws, new Map());
    const wMap = weekRoutineDates.get(ws)!;
    if (!wMap.has(routineId)) wMap.set(routineId, []);
    wMap.get(routineId)!.push(date);
  }

  const markedDates: MarkedDates = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    if (dateKey > today) break;
    if (dateKey < earliestRoutineDate) continue;

    // 이 날 이전에 이미 quota를 달성한 weekly_count 루틴 집합
    const ws = getWeekStart(dateKey);
    const wMap = weekRoutineDates.get(ws) ?? new Map<string, string[]>();
    const quotaMetBeforeThisDay = new Set(
      routineSchedules
        .filter((r) => {
          if (r.frequency !== 'weekly_count') return false;
          const dates = wMap.get(r.id) ?? [];
          return dates.filter((d) => d < dateKey).length >= (r.weeklyCount ?? 1);
        })
        .map((r) => r.id),
    );

    const scheduled = getScheduledCountForDate(dateKey, routineSchedules, quotaMetBeforeThisDay);
    if (scheduled === 0) continue;

    // quota 이미 달성된 weekly_count 완료분은 제외하고 카운트
    const routineIdsOnDay = completionsByDate.get(dateKey) ?? new Set<string>();
    const completed = [...routineIdsOnDay].filter((id) => !quotaMetBeforeThisDay.has(id)).length;

    const isFullyDone = completed >= scheduled;
    markedDates[dateKey] = {
      marked: true,
      dotColor: isFullyDone ? '#10B981' : completed > 0 ? '#F59E0B' : '#EF4444',
    };
  }

  markedDates[today] = {
    ...(markedDates[today] ?? {}),
    selected: true,
    selectedColor: '#6366F120',
  };

  return markedDates;
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 요약 카드 (상단 3개 지표)
// ─────────────────────────────────────────────

interface SummaryCardsProps {
  todayCompleted: number;
  todayScheduled: number;
  weeklyRate: number;
  maxStreak: number;
  maxStreakUnit: string;
  totalCompletions: number;
}

const SummaryCards = React.memo(function SummaryCards({
  todayCompleted,
  todayScheduled,
  weeklyRate,
  maxStreak,
  maxStreakUnit,
  totalCompletions,
}: SummaryCardsProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={summaryStyles.wrapper}>
      {/* 첫 번째 행: 오늘 완료 / 주간 달성률 / 최고 스트릭 */}
      <View style={summaryStyles.row}>
        {/* 오늘 완료 */}
        <Surface
          style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]}
          elevation={1}
        >
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={24}
            color={theme.colors.secondary}
          />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {todayCompleted}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>
              {' '}/ {todayScheduled}
            </Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>
            오늘 완료
          </Text>
        </Surface>

        {/* 주간 달성률 */}
        <Surface
          style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]}
          elevation={1}
        >
          <MaterialCommunityIcons
            name="chart-line"
            size={24}
            color={theme.colors.primary}
          />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {weeklyRate}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>%</Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>
            주간 달성률
          </Text>
        </Surface>

        {/* 최고 스트릭 */}
        <Surface
          style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]}
          elevation={1}
        >
          <MaterialCommunityIcons
            name="fire"
            size={24}
            color="#F59E0B"
          />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {maxStreak}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>{maxStreakUnit}</Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>
            최고 스트릭
          </Text>
        </Surface>
      </View>

      {/* 두 번째 행: 누적 완료 횟수 */}
      <Surface
        style={[summaryStyles.totalCard, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <MaterialCommunityIcons name="trophy-outline" size={20} color="#6366F1" />
        <Text style={[summaryStyles.totalValue, { color: theme.colors.onSurface }]}>
          {totalCompletions}
          <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>회</Text>
        </Text>
        <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>
          누적 완료 횟수
        </Text>
      </Surface>
    </View>
  );
});

const summaryStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  totalCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  valueUnit: {
    fontSize: 13,
    fontWeight: '400',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// ─────────────────────────────────────────────
// 서브 컴포넌트: 주간 달성률 차트
// ─────────────────────────────────────────────

interface WeeklyChartProps {
  chartData: { label: string; value: number; scheduled: number }[];
}

const WeeklyChart = React.memo(function WeeklyChart({
  chartData,
}: WeeklyChartProps): React.JSX.Element {
  const theme = useTheme();

  // react-native-gifted-charts BarChart 데이터 형식으로 변환
  const barData = useMemo(
    () =>
      chartData.map((item) => ({
        value: item.value,
        label: item.label,
        // 막대 색상: 80% 이상이면 초록, 50% 이상이면 인디고, 그 미만이면 아웃라인
        frontColor:
          item.value >= 80
            ? '#10B981'
            : item.value >= 50
            ? theme.colors.primary
            : theme.colors.outline,
        topLabelComponent: () => (
          <Text style={{ fontSize: 9, color: theme.colors.onSurfaceVariant, marginBottom: 2 }}>
            {item.value > 0 ? item.value : '0%'}
          </Text>
        ),
      })),
    [chartData, theme],
  );

  return (
    <Surface
      style={[chartStyles.card, { backgroundColor: theme.colors.surface }]}
      elevation={1}
    >
      {/* 섹션 제목 */}
      <View style={chartStyles.titleRow}>
        <MaterialCommunityIcons name="chart-bar" size={18} color={theme.colors.primary} />
        <Text style={[chartStyles.title, { color: theme.colors.onSurface }]}>
          주간 달성률
        </Text>
      </View>

      <BarChart
        data={barData}
        // 차트 높이 및 너비 설정
        height={120}
        barWidth={28}
        barBorderRadius={6}
        spacing={14}
        // Y축 범위: 0 ~ 110% (100% 막대 상단 레이블 잘림 방지)
        maxValue={110}
        noOfSections={4}
        // 격자선 스타일
        rulesColor={theme.colors.outlineVariant}
        rulesType="solid"
        // Y축 레이블 숨김 (퍼센트 표시 불필요)
        hideYAxisText
        // X축 레이블 스타일
        xAxisLabelTextStyle={{
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        }}
        // X/Y축 선 색상
        xAxisColor={theme.colors.outlineVariant}
        yAxisColor="transparent"
        // 배경색 투명
        backgroundColor="transparent"
        // 애니메이션
        isAnimated
        animationDuration={500}
      />

      {/* 범례 */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>80%+</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>50%+</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: theme.colors.outline }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>50% 미만</Text>
        </View>
      </View>
    </Surface>
  );
});

const chartStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.md,
    padding: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});

// ─────────────────────────────────────────────
// 서브 컴포넌트: 월간 달성 캘린더
// ─────────────────────────────────────────────

interface MonthlyCalendarProps {
  today: string;
  routineSchedules: RoutineScheduleInfo[];
  earliestRoutineDate: string;
}

const MonthlyCalendar = React.memo(function MonthlyCalendar({
  today,
  routineSchedules,
  earliestRoutineDate,
}: MonthlyCalendarProps): React.JSX.Element {
  const theme = useTheme();
  const [year, month] = today.split('-').map(Number);
  // 현재 캘린더에 표시 중인 연/월 상태
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});

  // 표시 월 변경 시 해당 달 데이터 재조회
  useEffect(() => {
    let cancelled = false;
    const monthStr = String(viewMonth).padStart(2, '0');
    const startDate = `${viewYear}-${monthStr}-01`;
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const endDate = `${viewYear}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
    getRoutineCompletionsInRange(startDate, endDate <= today ? endDate : today).then((routineCompletions) => {
      if (!cancelled) {
        setMarkedDates(buildMarkedDates(viewYear, viewMonth, today, routineSchedules, routineCompletions, earliestRoutineDate));
      }
    });
    return () => { cancelled = true; };
  }, [viewYear, viewMonth, today, routineSchedules, earliestRoutineDate]);

  return (
    <Surface
      style={[calendarStyles.card, { backgroundColor: theme.colors.surface }]}
      elevation={1}
    >
      {/* 섹션 제목 */}
      <View style={calendarStyles.titleRow}>
        <MaterialCommunityIcons name="calendar-check" size={18} color={theme.colors.primary} />
        <Text style={[calendarStyles.title, { color: theme.colors.onSurface }]}>
          월간 달성 현황
        </Text>
      </View>

      <Calendar
        current={`${viewYear}-${String(viewMonth).padStart(2, '0')}-01`}
        markedDates={markedDates}
        // 미래 날짜 비활성화
        maxDate={today}
        // 월 이동 시 해당 달 데이터 재조회
        onMonthChange={(dateObj) => {
          setViewYear(dateObj.year);
          setViewMonth(dateObj.month);
        }}
        theme={{
          // 배경
          calendarBackground: 'transparent',
          // 날짜 텍스트
          dayTextColor: theme.colors.onSurface,
          // 비활성(미래) 날짜
          textDisabledColor: theme.colors.outline,
          // 오늘 날짜 텍스트
          todayTextColor: theme.colors.primary,
          // 선택된 날짜 배경
          selectedDayBackgroundColor: theme.colors.primaryContainer,
          selectedDayTextColor: theme.colors.onPrimaryContainer,
          // 헤더 (월/년 표시)
          monthTextColor: theme.colors.onSurface,
          textMonthFontWeight: '700',
          textMonthFontSize: 15,
          // 요일 헤더
          textSectionTitleColor: theme.colors.onSurfaceVariant,
          // 화살표 색상
          arrowColor: theme.colors.primary,
          // dot 마커
          dotColor: '#10B981',
          selectedDotColor: '#10B981',
        }}
      />

      {/* 범례 */}
      <View style={[calendarStyles.legend, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={calendarStyles.legendItem}>
          <View style={[calendarStyles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={[calendarStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>전체 완료</Text>
        </View>
        <View style={calendarStyles.legendItem}>
          <View style={[calendarStyles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[calendarStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>일부 완료</Text>
        </View>
        <View style={calendarStyles.legendItem}>
          <View style={[calendarStyles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[calendarStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>미완료</Text>
        </View>
      </View>
    </Surface>
  );
});

const calendarStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.md,
    padding: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});

// ─────────────────────────────────────────────
// 서브 컴포넌트: 루틴별 달성률 목록 아이템
// ─────────────────────────────────────────────

interface RoutineAchievementItemProps {
  item: RoutineAchievementRow;
  index: number;
}

const RoutineAchievementItem = React.memo(function RoutineAchievementItem({
  item,
  index,
}: RoutineAchievementItemProps): React.JSX.Element {
  const theme = useTheme();

  // 달성률에 따른 프로그레스 바 색상
  const progressColor =
    item.rate >= 0.8
      ? '#10B981'
      : item.rate >= 0.5
      ? theme.colors.primary
      : item.rate > 0
      ? '#F59E0B'
      : theme.colors.outline;

  return (
    <View
      style={[
        itemStyles.container,
        index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant },
      ]}
    >
      {/* 루틴 색상 인디케이터 + 제목 */}
      <View style={itemStyles.headerRow}>
        <View style={[itemStyles.colorDot, { backgroundColor: item.color }]} />
        <Text
          style={[itemStyles.title, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {item.streak > 0 && (
          <View style={itemStyles.streakBadge}>
            <MaterialCommunityIcons name="fire" size={12} color="#F59E0B" />
            <Text style={[itemStyles.streakText, { color: '#F59E0B' }]}>{item.streak}{item.frequency === 'weekly_count' ? '주' : '일'}</Text>
          </View>
        )}
        <Text style={[itemStyles.rateText, { color: theme.colors.onSurfaceVariant }]}>
          {Math.round(item.rate * 100)}%
        </Text>
      </View>

      {/* 프로그레스 바 */}
      <ProgressBar
        progress={item.rate}
        color={progressColor}
        style={[itemStyles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}
      />

      {/* 완료 횟수 / 기준 */}
      <Text style={[itemStyles.subText, { color: theme.colors.outline }]}>
        {item.completedDays}{item.frequency === 'weekly_count' ? '회' : '일'} 완료 / {item.totalDays}{item.frequency === 'weekly_count' ? '회' : '일'} 기준
      </Text>
    </View>
  );
});

const itemStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F59E0B18',
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rateText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.xs,
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────
// 서브 컴포넌트: 루틴별 달성률 섹션
// ─────────────────────────────────────────────

interface RoutineListSectionProps {
  achievements: RoutineAchievementRow[];
}

const RoutineListSection = React.memo(function RoutineListSection({
  achievements,
}: RoutineListSectionProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Surface
      style={[listStyles.card, { backgroundColor: theme.colors.surface }]}
      elevation={1}
    >
      {/* 섹션 제목 */}
      <View style={listStyles.titleRow}>
        <MaterialCommunityIcons name="format-list-checks" size={18} color={theme.colors.primary} />
        <Text style={[listStyles.title, { color: theme.colors.onSurface }]}>
          루틴별 달성률
        </Text>
      </View>

      {achievements.length === 0 ? (
        // 루틴이 없을 때 빈 상태
        <View style={listStyles.empty}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={theme.colors.outline} />
          <Text style={[listStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            등록된 루틴이 없어요
          </Text>
          <Text style={[listStyles.emptySubText, { color: theme.colors.outline }]}>
            루틴 탭에서 루틴을 먼저 추가해 주세요
          </Text>
        </View>
      ) : (
        achievements.map((item, index) => (
          <RoutineAchievementItem key={item.routineId} item={item} index={index} />
        ))
      )}
    </Surface>
  );
});

const listStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.md,
    padding: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

// ─────────────────────────────────────────────
// 메인 화면 컴포넌트
// ─────────────────────────────────────────────

export default function AchievementScreen(): React.JSX.Element {
  const theme = useTheme();
  const { data, loading, error } = useAchievementData();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'routines'>('weekly');

  const today = useMemo(() => toLocalDateStr(), []);

  // ── 로딩 상태 ─────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            데이터를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── 에러 상태 ─────────────────────────────────
  if (error || data === null) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
            {error ?? '데이터를 불러올 수 없습니다.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── 정상 렌더링 ───────────────────────────────
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>

      {/* 페이지 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
          성과
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          나의 루틴 달성 현황
        </Text>
      </View>

      {/* 요약 카드 (탭 전환과 무관하게 항상 표시) */}
      <SummaryCards
        todayCompleted={data.todayCompleted}
        todayScheduled={data.todayScheduled}
        weeklyRate={data.weeklyRate}
        maxStreak={data.maxStreak}
        maxStreakUnit={data.maxStreakUnit}
        totalCompletions={data.totalCompletions}
      />

      {/* 탭 버튼 */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        buttons={[
          { value: 'weekly', label: '주간' },
          { value: 'monthly', label: '월간' },
          { value: 'routines', label: '루틴별' },
        ]}
        style={styles.tabButtons}
      />

      {/* 탭 콘텐츠 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'weekly' && (
          <WeeklyChart chartData={data.weeklyChartData} />
        )}
        {activeTab === 'monthly' && (
          <MonthlyCalendar
            today={today}
            routineSchedules={data.routineSchedules}
            earliestRoutineDate={data.earliestRoutineDate}
          />
        )}
        {activeTab === 'routines' && (
          <RoutineListSection achievements={data.routineAchievements} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// 스타일 정의
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // 페이지 헤더
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  // 탭 버튼
  tabButtons: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  // 스크롤 뷰
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  // 로딩/에러 상태
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
