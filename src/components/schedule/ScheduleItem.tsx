import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../theme';
import type { Schedule } from '../../db/scheduleDb';
import { getNameColor } from '../../utils/nameTag';

interface ScheduleItemProps {
  schedule: Schedule;
  onPress: (schedule: Schedule) => void;
  onLongPress: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}

export default function ScheduleItem({
  schedule,
  onPress,
  onLongPress,
  onDelete,
}: ScheduleItemProps): React.JSX.Element {
  const theme = useTheme();

  const nameTagColor = schedule.nameTagColor ?? (schedule.nameTag ? getNameColor(schedule.nameTag) : null);

  // 시간/날짜 메타 텍스트 생성
  const timeMeta = (() => {
    const isMultiDay = schedule.endDate && schedule.endDate !== schedule.date;
    const hasTime = schedule.startTime && schedule.endTime;
    if (isMultiDay) {
      const [, sm, sd] = schedule.date.split('-').map(Number);
      const [, em, ed] = (schedule.endDate as string).split('-').map(Number);
      const dateRange = `${sm}/${sd} ~ ${em}/${ed}`;
      return hasTime ? `${dateRange} · ${schedule.startTime} ~ ${schedule.endTime}` : dateRange;
    }
    return hasTime ? `${schedule.startTime} ~ ${schedule.endTime}` : null;
  })();

  return (
    <Surface
      style={[styles.surface, { backgroundColor: theme.colors.surface }]}
      elevation={1}
    >
      <View style={styles.row}>
        {/* 메인 터치 영역 */}
        <TouchableOpacity
          style={styles.touchable}
          onPress={() => onPress(schedule)}
          onLongPress={() => onLongPress(schedule)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${schedule.title} 일정`}
        >
          {/* 왼쪽 색상 바 */}
          <View style={[styles.colorBar, { backgroundColor: schedule.nameTagColor || schedule.color }]} />

          {/* 콘텐츠 */}
          <View style={styles.content}>
            {/* 제목 */}
            <Text
              style={[styles.title, { color: theme.colors.onSurface }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {schedule.title}
            </Text>

            {/* 날짜·시간 · 알람 */}
            {(timeMeta || schedule.alarm) && (
              <View style={styles.metaRow}>
                {timeMeta ? (
                  <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                    {timeMeta}
                  </Text>
                ) : null}
                {schedule.alarm && (
                  <MaterialCommunityIcons
                    name="bell-outline"
                    size={12}
                    color={theme.colors.primary}
                  />
                )}
              </View>
            )}

            {/* 장소 */}
            {schedule.location ? (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {schedule.location}
                </Text>
              </View>
            ) : null}

            {/* 메모 */}
            {schedule.memo ? (
              <Text
                style={[styles.memoText, { color: theme.colors.outline }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {schedule.memo}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* 오른쪽: 이름표 뱃지 · 삭제 버튼 — 가로 일렬 */}
        <View style={styles.actions}>
          {schedule.nameTag && nameTagColor && (
            <View
              style={[
                styles.nameTagBadge,
                { backgroundColor: nameTagColor + '22', borderColor: nameTagColor + '66' },
              ]}
            >
              <Text style={[styles.nameTagText, { color: nameTagColor }]}>
                {schedule.nameTag}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(schedule)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="일정 삭제"
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={20}
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  alarmIcon: {
    marginRight: 1,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
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
  nameTagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  nameTagText: {
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
