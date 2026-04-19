import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../theme';
import type { Routine } from '../../db/routineDb';
import { toLocalDateStr } from '../../utils/date';

// '매일' 또는 '주 N회 · 월수금' 형태의 빈도 라벨 반환
const DAY_LABELS: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 0: '일' };

function formatFrequency(routine: Routine): string {
  if (routine.frequency === 'daily') return '매일';
  if (routine.frequency === 'weekly_count') return `주 ${routine.weeklyCount ?? '?'}회`;
  if (!routine.weekdays || routine.weekdays.length === 0) return '요일 선택';
  const days = [...routine.weekdays]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(d => DAY_LABELS[d])
    .join('');
  return `주 ${routine.weekdays.length}회 · ${days}`;
}

// 요일 레이블 및 JS getDay() 매핑: 월(1)~토(6)~일(0) 순서
const WEEK_DAYS: Array<{ label: string; jsDay: number }> = [
  { label: '월', jsDay: 1 },
  { label: '화', jsDay: 2 },
  { label: '수', jsDay: 3 },
  { label: '목', jsDay: 4 },
  { label: '금', jsDay: 5 },
  { label: '토', jsDay: 6 },
  { label: '일', jsDay: 0 },
];

/**
 * 이번 주 월~일 날짜 배열을 반환한다 (YYYY-MM-DD 형식, 7개).
 * 월요일부터 일요일까지 순서대로 반환한다.
 */
function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysFromMonday + i);
    return toLocalDateStr(d);
  });
}

interface RoutineItemProps {
  routine: Routine;
  isCompleted: boolean;
  /** 이번 주 완료된 날짜 배열 (e.g. ['2026-04-14', '2026-04-16']) */
  weekCompletions: string[];
  /** weekly_count 루틴의 이번 주 quota 달성 여부 */
  isQuotaMet?: boolean;
  /** false이면 체크 버튼 숨김 (내 루틴 관리 탭용, 기본값 true) */
  showCheckButton?: boolean;
  onToggle: (routineId: string) => void;
  onPress: (routine: Routine) => void;
  onLongPress: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
}

export default function RoutineItem({
  routine,
  isCompleted,
  weekCompletions,
  isQuotaMet = false,
  showCheckButton = true,
  onToggle,
  onPress,
  onLongPress,
  onDelete,
}: RoutineItemProps): React.JSX.Element {
  const theme = useTheme();

  // 이번 주 날짜 배열 (컴포넌트 렌더마다 재계산 방지)
  const weekDates = useMemo(() => getWeekDates(), []);

  // 체크 버튼 핸들러 — 카드 onPress와 분리
  const handleToggle = useCallback(() => {
    onToggle(routine.id);
  }, [onToggle, routine.id]);

  const handlePress = useCallback(() => {
    onPress(routine);
  }, [onPress, routine]);

  const handleLongPress = useCallback(() => {
    onLongPress(routine);
  }, [onLongPress, routine]);

  const handleDelete = useCallback(() => {
    onDelete(routine);
  }, [onDelete, routine]);

  return (
    <Surface
      style={[
        styles.surface,
        { backgroundColor: theme.colors.surface },
        // 완료된 항목 또는 weekly_count quota 달성 시 opacity 낮춤
        (isCompleted || isQuotaMet) && styles.surfaceCompleted,
      ]}
      elevation={1}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${routine.title} 루틴 ${isCompleted ? '완료됨' : '미완료'}`}
      >
        {/* 왼쪽 카테고리 색상 바 */}
        <View style={[styles.colorBar, { backgroundColor: routine.color }]} />

        {/* 중간 콘텐츠 */}
        <View style={styles.content}>
          {/* 제목 */}
          <Text
            style={[
              styles.title,
              { color: theme.colors.onSurface },
              // 완료 또는 quota 달성 시 취소선 + 흐려짐
              (isCompleted || isQuotaMet) && styles.titleCompleted,
              (isCompleted || isQuotaMet) && { color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {routine.title}
          </Text>

          {/* 하단 행: 카테고리 + 스트릭 + 알람 */}
          <View style={styles.metaRow}>
            {/* 카테고리 텍스트 */}
            <Text style={[styles.category, { color: theme.colors.onSurfaceVariant }]}>
              {routine.category}
            </Text>

            {/* 빈도 라벨 */}
            <Text style={[styles.metaBadge, { color: theme.colors.onSurfaceVariant }]}>
              {' · '}{formatFrequency(routine)}
            </Text>

            {/* 스트릭 (1일 이상일 때만) */}
            {routine.streak > 0 && (
              <Text style={[styles.metaBadge, { color: theme.colors.onSurfaceVariant }]}>
                {'  🔥 '}{routine.streak}{routine.frequency === 'weekly_count' ? '주' : '일'}
              </Text>
            )}

            {/* 알람 시간 (알람 켜져 있을 때만) */}
            {routine.alarm && routine.alarmTime && (
              <View style={styles.alarmRow}>
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={11}
                  color={theme.colors.primary}
                />
                <Text style={[styles.alarmText, { color: theme.colors.primary }]}>
                  {' '}{routine.alarmTime}
                </Text>
              </View>
            )}
          </View>

          {/* 주간 완료 현황 도트 */}
          {routine.frequency === 'weekly_count' && routine.weeklyCount ? (
            // weekly_count: 목표 횟수만큼 dot 나열, 완료 수만큼 채움 (●●○)
            <View style={styles.weekRow}>
              {Array.from({ length: routine.weeklyCount }, (_, i) => (
                <View key={i} style={styles.weekDotItem}>
                  <View
                    style={[
                      styles.weekDot,
                      i < weekCompletions.length
                        ? { backgroundColor: routine.color }
                        : { borderColor: theme.colors.outlineVariant, borderWidth: 1 },
                    ]}
                  />
                </View>
              ))}
            </View>
          ) : (
            // daily / weekly_days: 요일별 도트 (월~일)
            <View style={styles.weekRow}>
              {WEEK_DAYS.map(({ label, jsDay }, index) => {
                const date = weekDates[index];
                const isScheduled = routine.frequency === 'daily' || routine.weekdays?.includes(jsDay);
                const isDone = weekCompletions.includes(date);

                if (!isScheduled) {
                  return <View key={jsDay} style={styles.weekDotPlaceholder} />;
                }

                return (
                  <View key={jsDay} style={styles.weekDotItem}>
                    <View
                      style={[
                        styles.weekDot,
                        isDone
                          ? { backgroundColor: routine.color }
                          : { borderColor: theme.colors.outlineVariant, borderWidth: 1 },
                      ]}
                    />
                    <Text style={[styles.weekDotLabel, { color: theme.colors.onSurfaceVariant }]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 삭제 버튼 */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="루틴 삭제"
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {/* 체크 버튼 (showCheckButton이 false이면 숨김) */}
        {showCheckButton && (
          <TouchableOpacity
            style={styles.checkButton}
            onPress={(isQuotaMet && !isCompleted) ? undefined : handleToggle}
            disabled={isQuotaMet && !isCompleted}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isCompleted || isQuotaMet }}
            accessibilityLabel={(isCompleted || isQuotaMet) ? '완료 취소' : '완료로 표시'}
          >
            <MaterialCommunityIcons
              name={(isCompleted || isQuotaMet) ? 'check-circle' : 'circle-outline'}
              size={26}
              color={(isCompleted || isQuotaMet) ? theme.colors.primary : theme.colors.outline}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Surface>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  // 완료 상태: 전체 opacity 0.6
  surfaceCompleted: {
    opacity: 0.6,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  // 왼쪽 카테고리 색상 바
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  // 완료 시 취소선 스타일
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  category: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaBadge: {
    fontSize: 12,
  },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  alarmText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // 주간 완료 현황 도트 영역
  weekRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  weekDotItem: {
    alignItems: 'center',
    gap: 2,
    width: 28,
  },
  weekDotPlaceholder: {
    width: 28,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weekDotLabel: {
    fontSize: 9,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    minWidth: 36,
    minHeight: 48,
  },
  checkButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 48,
  },
});
