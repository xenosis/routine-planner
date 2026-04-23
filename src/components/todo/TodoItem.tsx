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

interface DdayInfo {
  label: string;
  diffDays: number;
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
  if (diffDays === 0) label = '오늘';
  else if (diffDays === 1) label = '내일';
  else if (diffDays > 1) label = `D-${diffDays}`;
  else label = `D+${Math.abs(diffDays)}`;

  return { label, diffDays };
}

function getUrgencyColor(diffDays: number, fallback: string): string {
  if (diffDays < 0) return '#EF4444';
  if (diffDays === 0) return '#EF4444';
  if (diffDays <= 2) return '#F97316';
  if (diffDays <= 5) return '#F59E0B';
  if (diffDays <= 7) return '#EAB308';
  return fallback;
}

export default function TodoItem({
  todo,
  onPress,
  onDelete,
  onToggleComplete,
}: TodoItemProps): React.JSX.Element {
  const theme = useTheme();

  const ddayInfo = useMemo(() => calcDday(todo.deadlineDate), [todo.deadlineDate]);
  const urgencyColor = getUrgencyColor(ddayInfo.diffDays, theme.colors.onSurfaceVariant);
  const isOverdue = ddayInfo.diffDays < 0;

  const cardBg = !todo.completed && isOverdue
    ? (theme.dark ? '#3D1515' : '#FEF2F2')
    : theme.colors.surface;

  return (
    <Surface
      style={[styles.surface, { backgroundColor: cardBg, opacity: todo.completed ? 0.5 : 1 }]}
      elevation={1}
    >
      <View style={styles.row}>
        {/* 메인 터치 영역 */}
        <TouchableOpacity
          style={styles.touchable}
          onPress={() => onPress(todo)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${todo.title} 할일`}
        >
          <View style={[styles.colorBar, { backgroundColor: todo.color }]} />

          <View style={styles.content}>
            {/* 제목 */}
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

            {/* 카테고리 · 마감일시 · 알람 */}
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {todo.category}
              </Text>
              <Text style={[styles.metaDot, { color: theme.colors.outline }]}>·</Text>
              <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {todo.deadlineDate}
                {todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}
              </Text>
              {todo.alarm && (
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={12}
                  color={theme.colors.primary}
                  style={styles.alarmIcon}
                />
              )}
            </View>

            {/* 메모 (있을 때만) */}
            {todo.memo ? (
              <Text
                style={[styles.memoText, { color: theme.colors.outline }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {todo.memo}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* 오른쪽: D-day · 체크박스 · 삭제 — 가로 일렬 */}
        <View style={styles.actions}>
          {!todo.completed && (
            <View
              style={[
                styles.ddayBadge,
                { backgroundColor: urgencyColor + '22', borderColor: urgencyColor + '55' },
              ]}
            >
              <Text style={[styles.ddayText, { color: urgencyColor }]}>
                {ddayInfo.label}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(todo)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="할일 삭제"
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          <Checkbox
            status={todo.completed ? 'checked' : 'unchecked'}
            onPress={() => onToggleComplete(todo)}
            color={theme.colors.primary}
          />
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
    minHeight: 64,
  },
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
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaDot: {
    fontSize: 12,
    marginHorizontal: 3,
    lineHeight: 16,
  },
  alarmIcon: {
    marginLeft: spacing.xs,
  },
  memoText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  // 오른쪽 액션 행
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.xs,
    gap: 0,
  },
  ddayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  ddayText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    marginLeft: spacing.sm,
  },
});
