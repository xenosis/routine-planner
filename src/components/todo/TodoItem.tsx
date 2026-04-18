import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Checkbox, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../theme';
import type { Todo } from '../../db/todoDb';

interface TodoItemProps {
  todo: Todo;
  onPress: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
}

// ─────────────────────────────────────────────
// D-day 계산 헬퍼
// ─────────────────────────────────────────────

interface DdayInfo {
  label: string;
  isUrgent: boolean; // 마감 3일 이내 또는 초과 여부
}

function calcDday(deadlineDate: string): DdayInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = deadlineDate.split('-').map(Number);
  const deadline = new Date(y, m - 1, d);
  deadline.setHours(0, 0, 0, 0);

  const diffMs = deadline.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  if (diffDays === 0) {
    label = '오늘';
  } else if (diffDays === 1) {
    label = '내일';
  } else if (diffDays > 1) {
    label = `D-${diffDays}`;
  } else {
    // 마감 초과
    label = `D+${Math.abs(diffDays)}`;
  }

  // 마감 3일 이내(0~3일 남음) 또는 초과(음수)
  const isUrgent = diffDays <= 3;

  return { label, isUrgent };
}

export default function TodoItem({
  todo,
  onPress,
  onDelete,
  onToggleComplete,
}: TodoItemProps): React.JSX.Element {
  const theme = useTheme();

  // D-day 계산 (마감일 기반)
  const ddayInfo = useMemo(() => calcDday(todo.deadlineDate), [todo.deadlineDate]);

  // 완료 상태이면 카드 전체를 흐리게 처리
  const cardOpacity = todo.completed ? 0.5 : 1;

  // D-day 텍스트 색상: 긴급(3일 이내/초과) → error, 그 외 → onSurfaceVariant
  const ddayColor = ddayInfo.isUrgent
    ? theme.colors.error
    : theme.colors.onSurfaceVariant;

  return (
    <Surface
      style={[
        styles.surface,
        { backgroundColor: theme.colors.surface, opacity: cardOpacity },
      ]}
      elevation={1}
    >
      <View style={styles.row}>
        {/* 메인 터치 영역 (수정 모달 열기) */}
        <TouchableOpacity
          style={styles.touchable}
          onPress={() => onPress(todo)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${todo.title} 할일`}
        >
          {/* 왼쪽 카테고리 색상 바 */}
          <View
            style={[styles.colorBar, { backgroundColor: todo.color }]}
          />

          {/* 콘텐츠 영역 */}
          <View style={styles.content}>
            {/* 제목 (완료 시 취소선) */}
            <Text
              style={[
                styles.title,
                { color: theme.colors.onSurface },
                todo.completed && styles.titleCompleted,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {todo.title}
            </Text>

            {/* 카테고리 · 마감일시 */}
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {todo.category}
              </Text>
              <Text style={[styles.metaDot, { color: theme.colors.outline }]}>
                ·
              </Text>
              <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {todo.deadlineDate}
                {todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}
              </Text>
              {/* 알람 아이콘 (알람 설정된 경우) */}
              {todo.alarm && (
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={12}
                  color={theme.colors.primary}
                  style={styles.alarmIcon}
                />
              )}
            </View>

            {/* 메모 1줄 미리보기 (있을 때만 표시) */}
            {todo.memo ? (
              <Text
                style={[styles.memoText, { color: theme.colors.outline }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {todo.memo}
              </Text>
            ) : null}

            {/* D-day 뱃지 */}
            <View
              style={[
                styles.ddayBadge,
                {
                  backgroundColor: ddayInfo.isUrgent
                    ? theme.colors.errorContainer ?? `${theme.colors.error}20`
                    : theme.colors.surfaceVariant,
                },
              ]}
            >
              <Text style={[styles.ddayText, { color: ddayColor }]}>
                {ddayInfo.label}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 오른쪽 버튼 그룹: 체크박스 + 삭제 */}
        <View style={styles.actions}>
          {/* 완료 체크박스 */}
          <Checkbox
            status={todo.completed ? 'checked' : 'unchecked'}
            onPress={() => onToggleComplete(todo)}
            color={theme.colors.primary}
          />

          {/* 삭제 버튼 */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(todo)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="할일 삭제"
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  touchable: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 56,
  },
  // 왼쪽 카테고리 색상 바
  colorBar: {
    width: 4,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  // 완료 상태: 취소선
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  metaDot: {
    fontSize: 12,
    marginHorizontal: 4,
    lineHeight: 16,
  },
  alarmIcon: {
    marginLeft: spacing.xs,
  },
  memoText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 1,
  },
  // D-day 뱃지
  ddayBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  ddayText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // 오른쪽 액션 그룹 (체크박스 + 삭제)
  actions: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: spacing.xs,
    gap: 0,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
