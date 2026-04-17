import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../theme';
import type { Schedule } from '../../db/scheduleDb';

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

  return (
    <Surface
      style={[
        styles.surface,
        { backgroundColor: theme.colors.surface },
      ]}
      elevation={1}
    >
      <View style={styles.row}>
        {/* 메인 터치 영역 (수정 모달 열기) */}
        <TouchableOpacity
          style={styles.touchable}
          onPress={() => onPress(schedule)}
          onLongPress={() => onLongPress(schedule)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${schedule.title} 일정`}
        >
          {/* 왼쪽 카테고리 색상 바 */}
          <View
            style={[styles.colorBar, { backgroundColor: schedule.color }]}
          />

          {/* 콘텐츠 영역 */}
          <View style={styles.content}>
            {/* 상단: 제목 + 알람 아이콘 */}
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: theme.colors.onSurface }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {schedule.title}
              </Text>
              {schedule.alarm && (
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={14}
                  color={theme.colors.primary}
                  style={styles.alarmIcon}
                />
              )}
            </View>

            {/* 중단: 시간 표시 */}
            <Text
              style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}
            >
              {schedule.startTime} ~ {schedule.endTime}
            </Text>

            {/* 장소 (있을 때만 표시) */}
            {schedule.location ? (
              <View style={styles.locationRow}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[styles.locationText, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {schedule.location}
                </Text>
              </View>
            ) : null}

            {/* 참석자 (있을 때만 표시) */}
            {schedule.participants ? (
              <View style={styles.locationRow}>
                <MaterialCommunityIcons
                  name="account-multiple-outline"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[styles.locationText, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {schedule.participants}
                </Text>
              </View>
            ) : null}

            {/* 메모 1줄 미리보기 (있을 때만 표시) */}
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

        {/* 삭제 버튼 (메인 터치와 분리) */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(schedule)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="일정 삭제"
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
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
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  alarmIcon: {
    marginLeft: spacing.xs,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  locationText: {
    fontSize: 12,
    flex: 1,
  },
  memoText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 1,
  },
});
