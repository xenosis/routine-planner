import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Divider,
  IconButton,
  SegmentedButtons,
  Surface,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing } from '../../theme';
import type { Routine } from '../../db/routineDb';

// 카테고리별 대표 색상
export const ROUTINE_CATEGORY_COLORS: Record<Routine['category'], string> = {
  '운동': '#10B981',
  '공부': '#6366F1',
  '청소': '#06B6D4',
  '관리': '#F59E0B',
  '기타': '#94A3B8',
};

// 카테고리 선택 옵션
const CATEGORY_OPTIONS: Array<{ value: Routine['category']; label: string }> = [
  { value: '운동', label: '운동' },
  { value: '공부', label: '공부' },
  { value: '청소', label: '청소' },
  { value: '관리', label: '관리' },
  { value: '기타', label: '기타' },
];

// 요일 버튼 레이블 및 JS getDay() 매핑
// 월(1) ~ 토(6) ~ 일(0) 순서
const WEEKDAY_BUTTONS: Array<{ label: string; jsDay: number }> = [
  { label: '월', jsDay: 1 },
  { label: '화', jsDay: 2 },
  { label: '수', jsDay: 3 },
  { label: '목', jsDay: 4 },
  { label: '금', jsDay: 5 },
  { label: '토', jsDay: 6 },
  { label: '일', jsDay: 0 },
];

interface AddRoutineScreenProps {
  visible: boolean;
  routine?: Routine;   // 수정 모드일 때 기존 데이터
  onSave: (routine: Routine) => void;
  onClose: () => void;
  onDelete?: () => void;   // 수정 모드일 때만 전달
}

// 새 루틴용 고유 ID 생성
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

// 오늘 날짜 문자열 반환 (YYYY-MM-DD)
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 루틴 알람을 스케줄링한다.
 * - daily: 매일 반복 트리거
 * - weekly_days: 각 요일별 주간 반복 트리거 (Expo WEEKLY)
 * 기존 알람을 전부 취소한 후 재등록한다.
 */
async function scheduleRoutineAlarm(routine: Routine): Promise<void> {
  if (!routine.alarm || !routine.alarmTime) return;

  try {
    // 알람 권한 확인
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return;
    }

    const [hourStr, minuteStr] = routine.alarmTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    // 기존 알람 전체 취소 (daily ID + weekly_days 각 요일 ID)
    await Notifications.cancelScheduledNotificationAsync(routine.id).catch(() => {});
    for (let day = 0; day <= 6; day++) {
      await Notifications.cancelScheduledNotificationAsync(`${routine.id}_${day}`).catch(() => {});
    }

    if (routine.frequency === 'daily') {
      // 매일 반복 알람
      await Notifications.scheduleNotificationAsync({
        identifier: routine.id,
        content: { title: '루틴 알림', body: `${routine.title} 할 시간이에요!` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    } else if (
      (routine.frequency === 'weekly_days' || routine.frequency === 'weekly_count') &&
      routine.weekdays && routine.weekdays.length > 0
    ) {
      // 요일별 주간 반복 알람
      // weekly_days: 루틴 예정 요일에 알람
      // weekly_count: 사용자가 별도 선택한 알람 요일에 알람
      // Expo WEEKLY weekday: 1=일, 2=월, ..., 7=토 (JS getDay()와 다름)
      for (const jsDay of routine.weekdays) {
        const expoWeekday = jsDay === 0 ? 1 : jsDay + 1;
        await Notifications.scheduleNotificationAsync({
          identifier: `${routine.id}_${jsDay}`,
          content: { title: '루틴 알림', body: `${routine.title} 할 시간이에요!` },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: expoWeekday,
            hour,
            minute,
          },
        });
      }
    }
  } catch (e) {
    // 알람 예약 실패 시 조용히 무시 (UI 블로킹 방지)
    console.warn('루틴 알람 예약 실패:', e);
  }
}

// ─────────────────────────────────────────────
// 시간 선택 컴포넌트 (시 / 분 +/- 버튼)
// ─────────────────────────────────────────────

interface TimePickerProps {
  value: string;           // "HH:mm"
  onChange: (time: string) => void;
}

function TimePicker({ value, onChange }: TimePickerProps): React.JSX.Element {
  const theme = useTheme();
  const [hour, minute] = value.split(':').map(Number);

  const pad = (n: number) => String(n).padStart(2, '0');

  const changeHour = (delta: number) => {
    const next = (hour + delta + 24) % 24;
    onChange(`${pad(next)}:${pad(minute)}`);
  };
  const changeMinute = (delta: number) => {
    const next = (minute + delta + 60) % 60;
    onChange(`${pad(hour)}:${pad(next)}`);
  };

  const btnColor = theme.colors.primary;
  const textColor = theme.colors.onSurface;
  const surfaceColor = theme.colors.surfaceVariant;

  return (
    <Surface
      style={[timePickerStyles.container, { backgroundColor: surfaceColor }]}
      elevation={0}
    >
      <MaterialCommunityIcons name="bell-outline" size={18} color={btnColor} />

      {/* 시(Hour) */}
      <View style={timePickerStyles.unit}>
        <TouchableOpacity onPress={() => changeHour(1)} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-up" size={22} color={btnColor} />
        </TouchableOpacity>
        <Text style={[timePickerStyles.timeText, { color: textColor }]}>{pad(hour)}</Text>
        <TouchableOpacity onPress={() => changeHour(-1)} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-down" size={22} color={btnColor} />
        </TouchableOpacity>
      </View>

      <Text style={[timePickerStyles.colon, { color: textColor }]}>:</Text>

      {/* 분(Minute) */}
      <View style={timePickerStyles.unit}>
        <TouchableOpacity onPress={() => changeMinute(5)} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-up" size={22} color={btnColor} />
        </TouchableOpacity>
        <Text style={[timePickerStyles.timeText, { color: textColor }]}>{pad(minute)}</Text>
        <TouchableOpacity onPress={() => changeMinute(-5)} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-down" size={22} color={btnColor} />
        </TouchableOpacity>
      </View>

      <Text style={[timePickerStyles.ampm, { color: theme.colors.onSurfaceVariant }]}>
        {hour < 12 ? '오전' : '오후'}
      </Text>
    </Surface>
  );
}

const timePickerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  unit: {
    alignItems: 'center',
    gap: 2,
    minWidth: 36,
  },
  timeText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1,
    minWidth: 36,
    textAlign: 'center',
  },
  colon: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  ampm: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
    alignSelf: 'center',
  },
});

export default function AddRoutineScreen({
  visible,
  routine,
  onSave,
  onClose,
  onDelete,
}: AddRoutineScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isEditMode = Boolean(routine);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Routine['category']>('운동');
  const [frequency, setFrequency] = useState<Routine['frequency']>('daily');

  // UI 상태
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weeklyCount, setWeeklyCount] = useState<number>(3);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmTime, setAlarmTime] = useState('07:00');

  // 수정 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (routine) {
      setTitle(routine.title);
      setCategory(routine.category);
      setFrequency(routine.frequency);
      setWeekdays(routine.weekdays ?? []);
      setWeeklyCount(routine.weeklyCount ?? 3);
      setAlarmEnabled(routine.alarm);
      setAlarmTime(routine.alarmTime ?? '07:00');
    } else {
      // 추가 모드 — 폼 초기화
      setTitle('');
      setCategory('운동');
      setFrequency('daily');
      setWeekdays([]);
      setWeeklyCount(3);
      setAlarmEnabled(false);
      setAlarmTime('07:00');
    }
    setShowCategoryMenu(false);
  }, [routine, visible]);

  // 요일 버튼 토글 핸들러
  const handleWeekdayToggle = useCallback((jsDay: number) => {
    setWeekdays((prev) =>
      prev.includes(jsDay)
        ? prev.filter((d) => d !== jsDay)
        : [...prev, jsDay],
    );
  }, []);

  // 저장 처리
  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    if (frequency === 'weekly_days' && weekdays.length === 0) return;
    if (frequency === 'weekly_count' && weeklyCount < 2) return;

    const newRoutine: Routine = {
      id: routine?.id ?? generateId(),
      title: title.trim(),
      category,
      color: ROUTINE_CATEGORY_COLORS[category],
      frequency,
      // weekly_days: 루틴 예정 요일 / weekly_count: 알람 요일
      weekdays: (frequency === 'weekly_days' || frequency === 'weekly_count') ? weekdays : undefined,
      weeklyCount: frequency === 'weekly_count' ? weeklyCount : undefined,
      alarm: alarmEnabled,
      alarmTime: alarmEnabled ? alarmTime : undefined,
      streak: routine?.streak ?? 0,
      createdAt: routine?.createdAt ?? getTodayString(),
    };

    // 알람 예약 처리
    if (alarmEnabled && alarmTime) {
      await scheduleRoutineAlarm(newRoutine);
    } else if (!alarmEnabled) {
      await Notifications.cancelScheduledNotificationAsync(newRoutine.id).catch(() => {});
      for (let day = 0; day <= 6; day++) {
        await Notifications.cancelScheduledNotificationAsync(`${newRoutine.id}_${day}`).catch(() => {});
      }
    }

    onSave(newRoutine);
  }, [
    title, category, frequency, weekdays, weeklyCount, alarmEnabled, alarmTime, routine, onSave,
  ]);

  // 저장 버튼 비활성화 조건
  const isSaveDisabled =
    !title.trim() ||
    (frequency === 'weekly_days' && weekdays.length === 0) ||
    (frequency === 'weekly_count' && weeklyCount < 2);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 상단 헤더 */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            {isEditMode ? '루틴 수정' : '루틴 추가'}
          </Text>
          <IconButton
            icon="close"
            size={22}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onClose}
            style={styles.closeButton}
          />
        </View>

        {/* 폼 영역 */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. 제목 */}
          <TextInput
            label="제목 *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            placeholder="루틴 제목을 입력하세요"
            maxLength={50}
            autoFocus={!isEditMode}
          />

          {/* 2. 카테고리 — 드롭다운 */}
          <View style={[styles.categoryWrapper, showCategoryMenu && { zIndex: 10 }]}>
            <View pointerEvents="none">
              <TextInput
                label="카테고리"
                value={category}
                mode="outlined"
                editable={false}
                style={styles.input}
                left={
                  <TextInput.Icon
                    icon={() => (
                      <View style={[styles.categoryDot, { backgroundColor: ROUTINE_CATEGORY_COLORS[category] }]} />
                    )}
                  />
                }
                right={<TextInput.Icon icon={showCategoryMenu ? 'chevron-up' : 'chevron-down'} />}
              />
            </View>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setShowCategoryMenu((v) => !v)}
              activeOpacity={0.8}
            />
            {showCategoryMenu && (
              <View style={[styles.categoryDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.categoryOption,
                      opt.value === category && { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    onPress={() => { setCategory(opt.value); setShowCategoryMenu(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: ROUTINE_CATEGORY_COLORS[opt.value] }]} />
                    <Text style={{ color: theme.colors.onSurface }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 3. 반복 주기 */}
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            반복
          </Text>
          <SegmentedButtons
            value={frequency}
            onValueChange={(val) => {
              setFrequency(val as Routine['frequency']);
              setWeekdays([]);
              setWeeklyCount(3);
            }}
            buttons={[
              { value: 'daily', label: '매일' },
              { value: 'weekly_days', label: '요일 지정' },
              { value: 'weekly_count', label: '주 N회' },
            ]}
            style={styles.segmented}
          />

          {/* 요일 선택 버튼 (weekly_days 선택 시에만 표시) */}
          {frequency === 'weekly_days' && (
            <View style={styles.weekdayRow}>
              {WEEKDAY_BUTTONS.map(({ label, jsDay }) => {
                const isSelected = weekdays.includes(jsDay);
                return (
                  <TouchableOpacity
                    key={jsDay}
                    onPress={() => handleWeekdayToggle(jsDay)}
                    style={[
                      styles.weekdayButton,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${label}요일 ${isSelected ? '선택됨' : '선택 안 됨'}`}
                  >
                    <Text
                      style={[
                        styles.weekdayLabel,
                        {
                          color: isSelected
                            ? theme.colors.onPrimary
                            : theme.colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {/* 요일 미선택 시 안내 문구 */}
          {frequency === 'weekly_days' && weekdays.length === 0 && (
            <Text style={[styles.weekdayHint, { color: theme.colors.error }]}>
              요일을 1개 이상 선택해주세요
            </Text>
          )}

          {/* 주 N회 횟수 선택 버튼 (weekly_count 선택 시에만 표시) */}
          {frequency === 'weekly_count' && (
            <View style={styles.countRow}>
              {[2, 3, 4, 5, 6].map((n) => {
                const isSelected = weeklyCount === n;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setWeeklyCount(n)}
                    style={[
                      styles.countButton,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.countLabel,
                        {
                          color: isSelected
                            ? theme.colors.onPrimary
                            : theme.colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {n}회
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Divider style={styles.divider} />

          {/* 4. 알람 스위치 */}
          <View style={styles.alarmRow}>
            <View style={styles.alarmLabelGroup}>
              <Text style={[styles.alarmLabel, { color: theme.colors.onSurface }]}>
                알람
              </Text>
              <Text style={[styles.alarmSub, { color: theme.colors.onSurfaceVariant }]}>
                {frequency === 'daily'
                  ? '매일 정해진 시간에 알림 받기'
                  : frequency === 'weekly_count'
                  ? '알림 받을 요일을 선택하세요'
                  : '선택한 요일에 알림 받기'}
              </Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={setAlarmEnabled}
              color={theme.colors.primary}
            />
          </View>

          {/* 알람 시간 선택 (알람 켰을 때만 표시) */}
          {alarmEnabled && (
            <TimePicker value={alarmTime} onChange={setAlarmTime} />
          )}

          {/* 알람 요일 선택 (weekly_count + 알람 ON 시에만 표시) */}
          {frequency === 'weekly_count' && alarmEnabled && (
            <>
              <Text style={[styles.alarmWeekdayLabel, { color: theme.colors.onSurfaceVariant }]}>
                알람 요일
              </Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_BUTTONS.map(({ label, jsDay }) => {
                  const isSelected = weekdays.includes(jsDay);
                  return (
                    <TouchableOpacity
                      key={jsDay}
                      onPress={() => handleWeekdayToggle(jsDay)}
                      style={[
                        styles.weekdayButton,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.surfaceVariant,
                        },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${label}요일 알람 ${isSelected ? '선택됨' : '선택 안 됨'}`}
                    >
                      <Text
                        style={[
                          styles.weekdayLabel,
                          {
                            color: isSelected
                              ? theme.colors.onPrimary
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* 하단 여백 (저장 버튼 가림 방지) */}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* 하단 고정 버튼 영역 */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.footerRow}>
            {/* 삭제 버튼 — 수정 모드일 때만 표시 */}
            {isEditMode && onDelete && (
              <Button
                mode="outlined"
                onPress={onDelete}
                style={[styles.deleteButton, { borderColor: theme.colors.error }]}
                contentStyle={styles.footerButtonContent}
                labelStyle={[styles.footerButtonLabel, { color: theme.colors.error }]}
              >
                삭제
              </Button>
            )}
            <Button
              mode="contained"
              onPress={handleSave}
              disabled={isSaveDisabled}
              style={[styles.saveButton, isEditMode && onDelete ? styles.saveButtonPartial : styles.saveButtonFull]}
              contentStyle={styles.footerButtonContent}
              labelStyle={styles.footerButtonLabel}
            >
              {isEditMode ? '수정 완료' : '루틴 저장'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    margin: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  input: {
    marginBottom: spacing.md,
  },
  categoryWrapper: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  categoryDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    zIndex: 999,
    elevation: 4,
    overflow: 'hidden',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
  segmented: {
    marginBottom: spacing.md,
  },
  // 요일 선택 버튼 행
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  weekdayButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekdayHint: {
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  // 주 N회 횟수 선택
  countRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  countButton: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  countLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  // 알람 요일 레이블 (weekly_count용)
  alarmWeekdayLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    letterSpacing: 0.3,
  },
  divider: {
    marginVertical: spacing.base,
  },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  alarmLabelGroup: {
    gap: 2,
  },
  alarmLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  alarmSub: {
    fontSize: 12,
  },
  bottomPadding: {
    height: spacing.xxxl,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteButton: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  saveButton: {
    borderRadius: borderRadius.md,
  },
  saveButtonPartial: {
    flex: 2,
  },
  saveButtonFull: {
    flex: 1,
  },
  footerButtonContent: {
    height: 48,
  },
  footerButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
