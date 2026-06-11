import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, SegmentedButtons, Surface, Text, useTheme, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';

import {
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

      const today = toLocalDateStr();
      const thisWeekDays = getThisWeekDays(today);
      const weekStart = thisWeekDays[0];

      // 병렬로 데이터 조회
      const [
        todayCompletedIds,
        totalRoutines,
        totalCompletions,
        weeklyRoutineCompletions,
        weeklyCompletionDetails,
        routineAchievements,
        earliestRoutineDate,
        routineSchedules,
      ] = await Promise.all([
        getTodayCompletedRoutineIds(today),
        getTotalRoutineCount(),
        getTotalCompletionCount(),
        getWeeklyCompletionsByRoutine(weekStart, today),
        getRoutineCompletionsInRange(weekStart, today),
        getRoutineAchievements(today),
        getEarliestRoutineCreatedAt(today),
        getRoutineScheduleInfo(),
      ]);

      const weeklyDoneMap = new Map(weeklyRoutineCompletions.map((r) => [r.routineId, r.count]));

      // weekly_count는 오늘 달성률 제외, 주간달성률에만 포함
      const weeklyCountIds = new Set(
        routineSchedules.filter((r) => r.frequency === 'weekly_count').map((r) => r.id),
      );

      // 오늘 예정된 루틴 수 (weekly_count 제외)
      const todayScheduled = getScheduledCountForDate(today, routineSchedules, weeklyCountIds);

      // 오늘 완료 루틴 수 (weekly_count 제외)
      const todayCompleted = todayCompletedIds.filter((id) => !weeklyCountIds.has(id)).length;

      // routineAchievements에서 최고 스트릭 루틴 도출 (단위 포함)
      const maxStreakRoutine = routineAchievements.reduce<typeof routineAchievements[number] | null>(
        (best, r) => (r.streak > (best?.streak ?? -1) ? r : best),
        null,
      );
      const maxStreak = maxStreakRoutine?.streak ?? 0;
      const maxStreakUnit = maxStreakRoutine?.frequency === 'weekly_count' ? '주' : '일';

      // 주간 차트: weekly_count 완전 제외 — 날짜별 루틴별 완료 데이터에서 필터링
      const filteredCompletionMap = new Map<string, number>();
      for (const { routineId, date } of weeklyCompletionDetails) {
        if (!weeklyCountIds.has(routineId)) {
          filteredCompletionMap.set(date, (filteredCompletionMap.get(date) ?? 0) + 1);
        }
      }
      const weeklyChartData = thisWeekDays.map((date) => {
        const completed = filteredCompletionMap.get(date) ?? 0;
        const scheduled = getScheduledCountForDate(date, routineSchedules, weeklyCountIds);
        const rate = scheduled > 0 ? Math.min(Math.round((completed / scheduled) * 100), 100) : 0;
        return {
          label: getDayLabel(date),
          value: rate,
          scheduled,
          date,
        };
      });

      // 주간 달성률: daily / weekly_days만 포함, weekly_count 제외
      // - weekly_days로 이번 주 아직 예정일 없는 루틴은 평균에서 제외 (기회 없음 → 0% 왜곡 방지)
      let weeklyRate = 0;
      const activeRoutines = routineSchedules.filter(
        (r) => r.createdAt <= today && r.frequency !== 'weekly_count',
      );
      if (activeRoutines.length > 0) {
        const rates = activeRoutines
          .map((routine) => {
            const done = weeklyDoneMap.get(routine.id) ?? 0;
            const scheduledDays = thisWeekDays.filter((d) => {
              if (d < routine.createdAt) return false;
              const [y, mo, day] = d.split('-').map(Number);
              const weekday = new Date(y, mo - 1, day).getDay();
              if (routine.frequency === 'daily') return true;
              return routine.weekdays?.includes(weekday) ?? false;
            }).length;
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

interface MonthlyStats {
  activeDays: number;
  perfectDays: number;
  excellentDays: number;
  avgRate: number;
}

/** 날짜별 달성률(0~100) Map과 월간 통계를 반환하는 순수 함수 */
function buildRateDates(
  year: number,
  month: number,
  today: string,
  routineSchedules: RoutineScheduleInfo[],
  routineCompletions: { routineId: string; date: string }[],
  earliestRoutineDate: string,
): { rates: Map<string, number>; stats: MonthlyStats } {
  const completionsByDate = new Map<string, Set<string>>();
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

  const rates = new Map<string, number>();
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');

  let totalRate = 0;
  let activeDays = 0;
  let perfectDays = 0;
  let excellentDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    if (dateKey > today) break;
    if (dateKey < earliestRoutineDate) continue;

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

    const routineIdsOnDay = completionsByDate.get(dateKey) ?? new Set<string>();
    const completed = [...routineIdsOnDay].filter((id) => !quotaMetBeforeThisDay.has(id)).length;
    const rate = Math.min(Math.round((completed / scheduled) * 100), 100);

    rates.set(dateKey, rate);
    activeDays++;
    totalRate += rate;
    if (rate >= 100) perfectDays++;
    if (rate >= 80) excellentDays++;
  }

  return {
    rates,
    stats: {
      activeDays,
      perfectDays,
      excellentDays,
      avgRate: activeDays > 0 ? Math.round(totalRate / activeDays) : 0,
    },
  };
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
      {/* 4개 카드 한 줄: 오늘 완료 / 주간 달성률 / 최고 스트릭 / 누적 완료 */}
      <View style={summaryStyles.row}>
        <Surface style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.secondary} />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {todayCompleted}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>/{todayScheduled}</Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>오늘 완료</Text>
        </Surface>

        <Surface style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <MaterialCommunityIcons name="chart-line" size={20} color={theme.colors.primary} />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {weeklyRate}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>%</Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>주간 달성률</Text>
        </Surface>

        <Surface style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <MaterialCommunityIcons name="fire" size={20} color="#F59E0B" />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {maxStreak}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>{maxStreakUnit}</Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>최고 스트릭</Text>
        </Surface>

        <Surface style={[summaryStyles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color="#6366F1" />
          <Text style={[summaryStyles.value, { color: theme.colors.onSurface }]}>
            {totalCompletions}
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>회</Text>
          </Text>
          <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>누적 완료</Text>
        </Surface>
      </View>
    </View>
  );
});

const summaryStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  valueUnit: {
    fontSize: 11,
    fontWeight: '400',
  },
  label: {
    fontSize: 10,
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

  // 주간 통계 계산
  const weeklyStats = useMemo(() => {
    const activeDays = chartData.filter((d) => d.scheduled > 0);
    const avgRate = activeDays.length > 0
      ? Math.round(activeDays.reduce((s, d) => s + d.value, 0) / activeDays.length)
      : 0;
    const perfectDays = activeDays.filter((d) => d.value === 100).length;
    const best = activeDays.reduce<{ label: string; value: number } | null>(
      (b, d) => (b === null || d.value > b.value ? d : b),
      null,
    );
    return { avgRate, perfectDays, best };
  }, [chartData]);

  // react-native-gifted-charts BarChart 데이터 형식으로 변환
  const barData = useMemo(
    () =>
      chartData.map((item) => ({
        value: item.value,
        label: item.label,
        // 막대 색상 4단계: 예정 없음 → 회색, 80%+ → 초록, 60%+ → 인디고, 40%+ → 주황, <40% → 빨강
        frontColor:
          item.scheduled === 0
            ? theme.colors.outline
            : item.value >= 80
            ? '#10B981'
            : item.value >= 60
            ? theme.colors.primary
            : item.value >= 40
            ? '#F59E0B'
            : '#EF4444',
        topLabelComponent: () => (
          <Text style={{ fontSize: 9, color: theme.colors.onSurfaceVariant, marginBottom: 2 }}>
            {item.scheduled > 0 ? `${item.value}%` : ''}
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
        height={160}
        barWidth={28}
        barBorderRadius={6}
        spacing={14}
        maxValue={110}
        noOfSections={4}
        rulesColor={theme.colors.outlineVariant}
        rulesType="solid"
        hideYAxisText
        xAxisLabelTextStyle={{
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        }}
        xAxisColor={theme.colors.outlineVariant}
        yAxisColor="transparent"
        backgroundColor="transparent"
        isAnimated
        animationDuration={500}
      />

      {/* 범례 */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>80% 이상</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>60% 이상</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>40% 이상</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[chartStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>40% 미만</Text>
        </View>
      </View>

      {/* 주간 통계 요약 */}
      <View style={[chartStyles.statsRow, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={chartStyles.statItem}>
          <Text style={[chartStyles.statValue, { color: theme.colors.onSurface }]}>
            {weeklyStats.avgRate}%
          </Text>
          <Text style={[chartStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>이번 주 평균</Text>
        </View>
        <View style={[chartStyles.statDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={chartStyles.statItem}>
          <Text style={[chartStyles.statValue, { color: theme.colors.onSurface }]}>
            {weeklyStats.perfectDays}일
          </Text>
          <Text style={[chartStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>100% 달성</Text>
        </View>
        <View style={[chartStyles.statDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={chartStyles.statItem}>
          {weeklyStats.best ? (
            <>
              <Text style={[chartStyles.statValue, { color: theme.colors.onSurface }]}>
                {weeklyStats.best.label} <Text style={{ fontSize: 12 }}>{weeklyStats.best.value}%</Text>
              </Text>
              <Text style={[chartStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>최고 달성 요일</Text>
            </>
          ) : (
            <>
              <Text style={[chartStyles.statValue, { color: theme.colors.onSurfaceVariant }]}>-</Text>
              <Text style={[chartStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>최고 달성 요일</Text>
            </>
          )}
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
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    marginVertical: spacing.xs,
  },
});

// ─────────────────────────────────────────────
// 서브 컴포넌트: 월간 달성 캘린더
// ─────────────────────────────────────────────

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const HEAT_COLORS = {
  perfect: '#10B981',
  excellent: '#34D39990',
  good: '#6366F175',
  fair: '#F59E0B75',
  low: '#EF444455',
};

function getRateColor(rate: number | undefined): string {
  if (rate === undefined) return 'transparent';
  if (rate >= 100) return HEAT_COLORS.perfect;
  if (rate >= 80) return HEAT_COLORS.excellent;
  if (rate >= 60) return HEAT_COLORS.good;
  if (rate >= 40) return HEAT_COLORS.fair;
  if (rate > 0) return HEAT_COLORS.low;
  return 'transparent';
}

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
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const [rates, setRates] = useState<Map<string, number>>(new Map());
  const [stats, setStats] = useState<MonthlyStats>({ activeDays: 0, perfectDays: 0, excellentDays: 0, avgRate: 0 });

  useEffect(() => {
    let cancelled = false;
    const monthStr = String(viewMonth).padStart(2, '0');
    const startDate = `${viewYear}-${monthStr}-01`;
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const endDate = `${viewYear}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
    getRoutineCompletionsInRange(startDate, endDate <= today ? endDate : today).then((completions) => {
      if (!cancelled) {
        const result = buildRateDates(viewYear, viewMonth, today, routineSchedules, completions, earliestRoutineDate);
        setRates(result.rates);
        setStats(result.stats);
      }
    });
    return () => { cancelled = true; };
  }, [viewYear, viewMonth, today, routineSchedules, earliestRoutineDate]);

  const goToPrev = useCallback(() => {
    let y = viewYear; let m = viewMonth - 1;
    if (m < 1) { m = 12; y -= 1; }
    setViewYear(y); setViewMonth(m);
  }, [viewYear, viewMonth]);

  const goToNext = useCallback(() => {
    let y = viewYear; let m = viewMonth + 1;
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y); setViewMonth(m);
  }, [viewYear, viewMonth]);

  // 날짜 셀 42개 계산 (6×7)
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
    const lastDate = new Date(viewYear, viewMonth, 0).getDate();
    const prevLastDate = new Date(viewYear, viewMonth - 1, 0).getDate();
    const result: Array<{ dateStr: string; day: number; isCurrent: boolean }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevLastDate - i;
      let y = viewYear; let m = viewMonth - 1;
      if (m < 1) { m = 12; y -= 1; }
      result.push({ dateStr: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrent: false });
    }
    for (let d = 1; d <= lastDate; d++) {
      result.push({ dateStr: `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrent: true });
    }
    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      let y = viewYear; let m = viewMonth + 1;
      if (m > 12) { m = 1; y += 1; }
      result.push({ dateStr: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrent: false });
    }
    return result;
  }, [viewYear, viewMonth]);

  const canGoNext = `${viewYear}-${String(viewMonth).padStart(2,'0')}` < today.slice(0, 7);

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

      {/* 월간 통계 카드 */}
      <View style={[calendarStyles.statsGrid, { backgroundColor: theme.colors.surfaceVariant + '60', borderRadius: borderRadius.sm }]}>
        <View style={calendarStyles.statsCell}>
          <Text style={[calendarStyles.statsValue, { color: theme.colors.onSurface }]}>{stats.activeDays}일</Text>
          <Text style={[calendarStyles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>예정일</Text>
        </View>
        <View style={[calendarStyles.statsDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={calendarStyles.statsCell}>
          <Text style={[calendarStyles.statsValue, { color: '#10B981' }]}>{stats.perfectDays}일</Text>
          <Text style={[calendarStyles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>완전 완료</Text>
        </View>
        <View style={[calendarStyles.statsDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={calendarStyles.statsCell}>
          <Text style={[calendarStyles.statsValue, { color: theme.colors.primary }]}>{stats.excellentDays}일</Text>
          <Text style={[calendarStyles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>80% 이상</Text>
        </View>
        <View style={[calendarStyles.statsDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={calendarStyles.statsCell}>
          <Text style={[calendarStyles.statsValue, { color: theme.colors.onSurface }]}>{stats.avgRate}%</Text>
          <Text style={[calendarStyles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>평균 달성률</Text>
        </View>
      </View>

      {/* 월 이동 헤더 */}
      <View style={calendarStyles.calHeader}>
        <IconButton icon="chevron-left" size={20} iconColor={theme.colors.onSurface} onPress={goToPrev} style={calendarStyles.headerBtn} />
        <Text style={[calendarStyles.calTitle, { color: theme.colors.onSurface }]}>
          {viewYear}년 {viewMonth}월
        </Text>
        <IconButton icon="chevron-right" size={20} iconColor={canGoNext ? theme.colors.onSurface : theme.colors.outline} onPress={canGoNext ? goToNext : undefined} style={calendarStyles.headerBtn} />
      </View>

      {/* 요일 헤더 */}
      <View style={calendarStyles.weekRow}>
        {WEEK_LABELS.map((label, idx) => (
          <View key={label} style={calendarStyles.weekCell}>
            <Text style={[calendarStyles.weekText, {
              color: idx === 0 ? '#EF4444' : idx === 6 ? '#3B82F6' : theme.colors.onSurfaceVariant,
            }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 (히트맵) */}
      <View style={calendarStyles.grid}>
        {cells.map((cell) => {
          const isToday = cell.dateStr === today;
          const isFuture = cell.dateStr > today;
          const rate = cell.isCurrent && !isFuture ? rates.get(cell.dateStr) : undefined;
          const bgColor = getRateColor(rate);

          let textColor = theme.colors.onBackground;
          if (!cell.isCurrent) textColor = theme.colors.outline;
          else if (isFuture) textColor = theme.colors.outline;
          else if (isToday) textColor = '#FFFFFF';
          else if (rate !== undefined && rate >= 100) textColor = '#FFFFFF';

          return (
            <View key={cell.dateStr} style={calendarStyles.dayCell}>
              <View style={[
                calendarStyles.dayCircle,
                { backgroundColor: isToday ? theme.colors.primary : bgColor },
                isToday && calendarStyles.todayCircle,
              ]}>
                <Text style={[
                  calendarStyles.dayText,
                  { color: textColor },
                  !cell.isCurrent && { opacity: 0.3 },
                ]}>
                  {cell.day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* 히트맵 범례 */}
      <View style={[calendarStyles.legend, { borderTopColor: theme.colors.outlineVariant }]}>
        {[
          { color: HEAT_COLORS.perfect, label: '100%' },
          { color: HEAT_COLORS.excellent, label: '80%+' },
          { color: HEAT_COLORS.good, label: '60%+' },
          { color: HEAT_COLORS.fair, label: '40%+' },
          { color: HEAT_COLORS.low, label: '40% 미만' },
        ].map(({ color, label }) => (
          <View key={label} style={calendarStyles.legendItem}>
            <View style={[calendarStyles.legendDot, { backgroundColor: color }]} />
            <Text style={[calendarStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
          </View>
        ))}
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
    marginBottom: spacing.base,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statsValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  statsDivider: {
    width: 1,
    marginVertical: spacing.xs,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerBtn: { margin: 0 },
  calTitle: { fontSize: 15, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  weekText: { fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    elevation: 2,
  },
  dayText: { fontSize: 13, fontWeight: '500' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
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
