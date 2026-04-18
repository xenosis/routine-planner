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
  getMonthlyCompletions,
  getRoutineAchievements,
  getTotalRoutineCount,
  getTodayCompletedCount,
  getMaxStreak,
  getTotalCompletionCount,
  getEarliestRoutineCreatedAt,
  type RoutineAchievementRow,
  type DailyCompletionRow,
} from '../../db/achievementDb';
import { borderRadius, spacing } from '../../theme';

// ─────────────────────────────────────────────
// 날짜 유틸리티 함수
// ─────────────────────────────────────────────

/** 오늘 날짜 문자열 반환 (YYYY-MM-DD, 로컬 타임존 기준) */
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 에서 N일 전 날짜 문자열 반환 */
function getDateBefore(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 에서 요일 두 글자 반환 (월, 화, 수, ...) */
function getDayLabel(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
}

/** 이번 주 월요일 ~ 오늘 사이의 날짜 문자열 배열 반환 (최대 7일) */
function getLast7Days(today: string): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(getDateBefore(today, i));
  }
  return dates;
}

// ─────────────────────────────────────────────
// 성과 데이터 타입
// ─────────────────────────────────────────────

interface AchievementData {
  /** 오늘 완료 루틴 수 */
  todayCompleted: number;
  /** 전체 루틴 수 */
  totalRoutines: number;
  /** 이번 주 달성률 (0 ~ 100) */
  weeklyRate: number;
  /** 최고 스트릭 */
  maxStreak: number;
  /** 누적 완료 횟수 */
  totalCompletions: number;
  /** 주간 차트 데이터 (7일) */
  weeklyChartData: { label: string; value: number; date: string }[];
  /** 루틴별 달성률 목록 */
  routineAchievements: RoutineAchievementRow[];
  /** 가장 오래된 루틴 생성일 */
  earliestRoutineDate: string;
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

      const today = getTodayString();
      const last7Days = getLast7Days(today);
      const weekStart = last7Days[0];

      // 병렬로 데이터 조회
      const [
        todayCompleted,
        totalRoutines,
        maxStreak,
        totalCompletions,
        weeklyCompletions,
        routineAchievements,
        earliestRoutineDate,
      ] = await Promise.all([
        getTodayCompletedCount(today),
        getTotalRoutineCount(),
        getMaxStreak(),
        getTotalCompletionCount(),
        getDailyCompletions(weekStart, today),
        getRoutineAchievements(today),
        getEarliestRoutineCreatedAt(today),
      ]);

      // 주간 달성률 계산
      const completionMap = new Map<string, number>(
        weeklyCompletions.map((r) => [r.date, r.completedCount]),
      );

      const weeklyChartData = last7Days.map((date) => {
        const completed = completionMap.get(date) ?? 0;
        // 달성률 = 완료 수 / 전체 루틴 수 * 100 (루틴 없으면 0)
        const rate = totalRoutines > 0 ? Math.round((completed / totalRoutines) * 100) : 0;
        return {
          label: getDayLabel(date),
          value: rate,
          date,
        };
      });

      // 이번 주 달성률 평균: 루틴이 존재하는 경우만 계산 (루틴이 없는 날 제외)
      // 루틴이 0개면 0%, 있으면 완료된 날의 달성률 평균
      let weeklyRate = 0;
      if (totalRoutines > 0) {
        // 오늘 이전이거나 오늘인 날 중, 완료 기록이 있거나 오늘인 날만 유효 날짜로 간주
        // 실용적 접근: 현재 루틴 수 기준으로 7일 평균 (루틴이 추가되기 전 날은 0%로 포함하지 않음)
        // → completionMap에 기록이 있는 날 + 오늘(루틴 추가 후 첫날 고려)만 평균
        const daysWithActivity = weeklyChartData.filter(
          (d) => completionMap.has(d.date) || d.date === today,
        );
        if (daysWithActivity.length > 0) {
          weeklyRate = Math.round(
            daysWithActivity.reduce((sum, d) => sum + d.value, 0) / daysWithActivity.length,
          );
        }
      }

      setData({
        todayCompleted,
        totalRoutines,
        weeklyRate,
        maxStreak,
        totalCompletions,
        weeklyChartData,
        routineAchievements,
        earliestRoutineDate,
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
  totalRoutines: number,
  monthlyCompletions: DailyCompletionRow[],
  earliestRoutineDate: string,
): MarkedDates {
  const monthCompletionMap = new Map<string, number>(
    monthlyCompletions.map((r) => [r.date, r.completedCount]),
  );

  const markedDates: MarkedDates = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    // 미래 날짜는 마킹 제외
    if (dateKey > today) break;

    // 루틴 추가 이전 날짜는 마킹 제외
    if (dateKey < earliestRoutineDate) continue;

    const completed = monthCompletionMap.get(dateKey) ?? 0;

    if (totalRoutines > 0) {
      const isFullyDone = completed >= totalRoutines;
      markedDates[dateKey] = {
        marked: true,
        dotColor: isFullyDone ? '#10B981' : completed > 0 ? '#F59E0B' : '#EF4444',
      };
    }
  }

  // 오늘 날짜는 선택 상태로 추가 표시
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
  totalRoutines: number;
  weeklyRate: number;
  maxStreak: number;
  totalCompletions: number;
}

const SummaryCards = React.memo(function SummaryCards({
  todayCompleted,
  totalRoutines,
  weeklyRate,
  maxStreak,
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
              {' '}/ {totalRoutines}
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
            <Text style={[summaryStyles.valueUnit, { color: theme.colors.onSurfaceVariant }]}>일</Text>
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
  chartData: { label: string; value: number }[];
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
        topLabelComponent: () =>
          item.value > 0 ? (
            <Text style={{ fontSize: 9, color: theme.colors.onSurfaceVariant, marginBottom: 2 }}>
              {item.value}
            </Text>
          ) : null,
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
  totalRoutines: number;
  earliestRoutineDate: string;
}

const MonthlyCalendar = React.memo(function MonthlyCalendar({
  today,
  totalRoutines,
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
    getMonthlyCompletions(viewYear, viewMonth).then((completions) => {
      if (!cancelled) {
        setMarkedDates(buildMarkedDates(viewYear, viewMonth, today, totalRoutines, completions, earliestRoutineDate));
      }
    });
    return () => { cancelled = true; };
  }, [viewYear, viewMonth, today, totalRoutines, earliestRoutineDate]);

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
            <Text style={[itemStyles.streakText, { color: '#F59E0B' }]}>{item.streak}일</Text>
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

      {/* 완료 일수 / 전체 일수 */}
      <Text style={[itemStyles.subText, { color: theme.colors.outline }]}>
        {item.completedDays}일 완료 / {item.totalDays}일 기준
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

  const today = useMemo(() => getTodayString(), []);

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
        totalRoutines={data.totalRoutines}
        weeklyRate={data.weeklyRate}
        maxStreak={data.maxStreak}
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
            totalRoutines={data.totalRoutines}
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
