import React, { useCallback, useState } from 'react';
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
  Chip,
  Divider,
  IconButton,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import TimeInput from '../../components/common/TimeInput';
import LocationSearchModal from '../../components/schedule/LocationSearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing } from '../../theme';
import type { Schedule } from '../../db/scheduleDb';
import MonthCalendar from '../../components/calendar/MonthCalendar';
import { useAuthStore } from '../../store/authStore';
import {
  scheduleAlarmNotifications,
  scheduleNextRepeatAlarm,
  formatAlarmTime,
} from '../../utils/scheduleAlarms';

// 카테고리별 대표 색상
export const CATEGORY_COLORS: Record<Schedule['category'], string> = {
  '업무': '#6366F1',
  '개인': '#10B981',
  '건강': '#F59E0B',
  '기타': '#94A3B8',
};

// 알람 프리셋 (분 단위)
const ALARM_PRESETS = [
  { label: '마감시각', minutes: 0 },
  { label: '10분', minutes: 10 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '1일', minutes: 1440 },
] as const;

// 직접 입력 단위
const TIME_UNITS = [
  { label: '분', value: 'min' as const },
  { label: '시간', value: 'hour' as const },
  { label: '일', value: 'day' as const },
  { label: '주', value: 'week' as const },
] as const;

type TimeUnit = 'min' | 'hour' | 'day' | 'week';

// 카테고리 선택 옵션
const CATEGORY_OPTIONS: Array<{ value: Schedule['category']; label: string }> = [
  { value: '업무', label: '업무' },
  { value: '개인', label: '개인' },
  { value: '건강', label: '건강' },
  { value: '기타', label: '기타' },
];

// 반복 옵션 목록
const REPEAT_OPTIONS: Array<{ value: NonNullable<Schedule['repeat']>; label: string }> = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
];

interface AddScheduleScreenProps {
  visible: boolean;
  initialDate: string;        // 선택된 날짜 (YYYY-MM-DD)
  schedule?: Schedule;        // 수정 모드일 때 기존 데이터
  onSave: (schedule: Schedule) => void;
  onClose: () => void;
  onDelete?: () => void;      // 수정 모드일 때만 전달
}

// 새 일정용 고유 ID 생성
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

export default function AddScheduleScreen({
  visible,
  initialDate,
  schedule,
  onSave,
  onClose,
  onDelete,
}: AddScheduleScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isEditMode = Boolean(schedule);
  const displayName = useAuthStore((s) => s.session?.user.user_metadata?.display_name ?? '');
  const nameColor = useAuthStore((s) => s.session?.user.user_metadata?.name_color ?? '');

  // 폼 상태 — 조건부 렌더링으로 마운트마다 올바른 초기값으로 시작
  const [title, setTitle] = useState(() => schedule?.title ?? '');
  const [date, setDate] = useState(() => schedule?.date ?? initialDate);
  const [endDate, setEndDate] = useState(() => schedule?.endDate ?? schedule?.date ?? initialDate);
  const [startTime, setStartTime] = useState(() => schedule?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(() => schedule?.endTime ?? '10:00');
  const [category, setCategory] = useState<Schedule['category']>(() => schedule?.category ?? '개인');
  const [location, setLocation] = useState(() => schedule?.location ?? '');
  const [nameTag, setNameTag] = useState(() => schedule ? (schedule.nameTag ?? '') : displayName);
  const [nameTagColor, setNameTagColor] = useState(() => schedule ? (schedule.nameTagColor ?? '') : nameColor);
  const [memo, setMemo] = useState(() => schedule?.memo ?? '');
  const [alarmEnabled, setAlarmEnabled] = useState(() => schedule?.alarm ?? false);

  // 반복 설정 상태
  const [repeatEnabled, setRepeatEnabled] = useState(() => !!schedule?.repeat);
  const [repeat, setRepeat] = useState<Schedule['repeat']>(() => schedule?.repeat);
  const [repeatUntil, setRepeatUntil] = useState(() => schedule?.repeatUntil ?? '');
  const [showRepeatUntilPicker, setShowRepeatUntilPicker] = useState(false);
  // 테스트용 분 단위 반복
  const [isMinutesModeActive, setIsMinutesModeActive] = useState(
    () => !!schedule?.repeat?.startsWith('minutes:'),
  );
  const [minutesInput, setMinutesInput] = useState(() =>
    schedule?.repeat?.startsWith('minutes:') ? schedule.repeat.split(':')[1] : '',
  );
  // 반복 알람 시각 (반복 일정의 실제 알람 트리거 시각, 비반복의 startTime과 독립)
  const [repeatAlarmTime, setRepeatAlarmTime] = useState(() =>
    schedule?.repeat ? (schedule.startTime ?? '') : '',
  );

  // UI 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end'>('start');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);

  // 복수 알람 상태
  const [alarmTimes, setAlarmTimes] = useState<number[]>(() => schedule?.alarmTimes ?? []);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<TimeUnit>('min');

  // 알람 토글 핸들러
  const handleAlarmToggle = useCallback((val: boolean) => {
    setAlarmEnabled(val);
    if (val) {
      setShowAddPanel(true);
    } else {
      setAlarmTimes([]);
      setShowAddPanel(false);
    }
  }, []);

  // 프리셋 알람 추가 핸들러 (중복 방지, 오름차순 정렬)
  const handleAddPreset = useCallback((minutes: number) => {
    setAlarmTimes((prev) => {
      if (prev.includes(minutes)) return prev;
      return [...prev, minutes].sort((a, b) => a - b);
    });
  }, []);

  // 직접 입력 알람 추가 핸들러
  const handleAddCustom = useCallback(() => {
    const num = parseInt(customValue, 10);
    if (!num || num <= 0) return;

    // 단위에 따라 분으로 변환
    let minutes = num;
    if (customUnit === 'hour') minutes = num * 60;
    if (customUnit === 'day') minutes = num * 1440;
    if (customUnit === 'week') minutes = num * 10080;

    setAlarmTimes((prev) => {
      if (prev.includes(minutes)) return prev;
      return [...prev, minutes].sort((a, b) => a - b);
    });
    setCustomValue('');
    setShowAddPanel(false);
  }, [customValue, customUnit]);

  // 알람 항목 제거 핸들러
  const handleRemoveAlarm = useCallback((minutes: number) => {
    setAlarmTimes((prev) => prev.filter((m) => m !== minutes));
  }, []);

  // 저장 처리
  const isTimeValid =
    repeatEnabled ||
    (!startTime && !endTime) || (!!startTime && !!endTime && endTime >= startTime);
  const isDateValid = endDate >= date;
  const canSetAlarm = !!startTime && !!endTime;

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    if (!repeatEnabled && startTime && endTime && endTime < startTime) return;
    if (endDate < date) return;

    // 반복 일정: 알람 시각(repeatAlarmTime)을 startTime으로 사용, alarmTimes=[0]으로 고정
    const isRepeatActive = repeatEnabled && !!(repeat);
    const effectiveStartTime = isRepeatActive ? (repeatAlarmTime || '09:00') : startTime;
    const effectiveEndTime = isRepeatActive ? (repeatAlarmTime || '09:00') : endTime;
    const hasRepeatAlarm = isRepeatActive && !!repeatAlarmTime;
    const hasAlarm = hasRepeatAlarm || (!repeatEnabled && alarmEnabled && alarmTimes.length > 0);

    const newSchedule: Schedule = {
      id: schedule?.id ?? generateId(),
      title: title.trim(),
      date,
      endDate: endDate !== date ? endDate : undefined,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      category,
      color: nameTagColor || CATEGORY_COLORS[category],
      memo: memo.trim() || undefined,
      alarm: hasAlarm,
      alarmTimes: hasRepeatAlarm ? [0] : (hasAlarm ? alarmTimes : undefined),
      location: location.trim() || undefined,
      nameTag: nameTag.trim() || undefined,
      nameTagColor: nameTag.trim() ? (nameTagColor || undefined) : undefined,
      repeat: repeat ?? undefined,
      repeatUntil: repeatUntil || undefined,
    };

    // onSave 먼저 호출 (store.updateSchedule이 기존 알람을 취소하므로, 반드시 완료 후 새 알람 등록)
    await (onSave(newSchedule) as unknown as Promise<void> | void);

    // 알람 예약: 반복이면 다음 발생일 1회, 비반복이면 복수 알람 등록
    if (newSchedule.alarm && newSchedule.alarmTimes?.length) {
      if (newSchedule.repeat) {
        await scheduleNextRepeatAlarm(newSchedule).catch(() => {});
      } else {
        await scheduleAlarmNotifications(newSchedule);
      }
    }
  }, [
    title, date, endDate, startTime, endTime, category,
    location, nameTag, nameTagColor, memo, alarmEnabled, alarmTimes,
    repeat, repeatUntil, repeatEnabled, repeatAlarmTime, isMinutesModeActive, schedule, onSave,
  ]);

  const isSaveDisabled = !title.trim() || !isTimeValid || !isDateValid;

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
            {isEditMode ? '일정 수정' : '일정 추가'}
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
          {/* 제목 */}
          <TextInput
            label="제목 *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            placeholder="일정 제목을 입력하세요"
            maxLength={50}
            autoFocus={!isEditMode}
          />

          {/* 날짜 행: 시작일 ~ 종료일 */}
          <View style={styles.dateTimeRow}>
            <TextInput
              label="시작일"
              value={date}
              onChangeText={(v) => {
                setDate(v);
                // 종료일이 시작일보다 앞서면 맞춤
                if (endDate < v) setEndDate(v);
              }}
              mode="outlined"
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
              maxLength={10}
              right={
                <TextInput.Icon
                  icon={showDatePicker && datePickerTarget === 'start' ? 'calendar-check' : 'calendar'}
                  onPress={() => {
                    setDatePickerTarget('start');
                    setShowDatePicker((v) => !(v && datePickerTarget === 'start'));
                  }}
                />
              }
            />
            <Text style={[styles.timeSeparator, { color: theme.colors.onSurfaceVariant }]}>
              ~
            </Text>
            <TextInput
              label="종료일"
              value={endDate}
              onChangeText={(v) => {
                setEndDate(v);
                if (v.length === 10) {
                  if (v !== date) {
                    // 다일 일정으로 변경: 시각·알람·반복 초기화
                    setStartTime('');
                    setEndTime('');
                    setAlarmEnabled(false);
                    setAlarmTimes([]);
                    setRepeatEnabled(false);
                    setRepeat(undefined);
                    setRepeatUntil('');
                    setMinutesInput('');
                    setIsMinutesModeActive(false);
                    setRepeatAlarmTime('');
                  } else {
                    if (!startTime) setStartTime('09:00');
                    if (!endTime) setEndTime('10:00');
                  }
                }
              }}
              mode="outlined"
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
              maxLength={10}
              right={
                <TextInput.Icon
                  icon={showDatePicker && datePickerTarget === 'end' ? 'calendar-check' : 'calendar'}
                  onPress={() => {
                    setDatePickerTarget('end');
                    setShowDatePicker((v) => !(v && datePickerTarget === 'end'));
                  }}
                />
              }
            />
          </View>

          {/* 시간 행: 시작시각 ~ 종료시각 + 카테고리 */}
          <View style={[styles.timeRow, showCategoryMenu && { zIndex: 10 }]}>
            <TimeInput
              label="시작"
              value={startTime}
              onChange={setStartTime}
              compact
              style={styles.timeInput}
            />
            <Text style={[styles.timeSeparator, { color: theme.colors.onSurfaceVariant }]}>
              ~
            </Text>
            <TimeInput
              label="종료"
              value={endTime}
              onChange={setEndTime}
              compact
              style={styles.timeInput}
            />
            {/* 카테고리 드롭다운 */}
            <View style={[styles.categoryWrapper, showCategoryMenu && { zIndex: 10 }]}>
              <View pointerEvents="none">
                <TextInput
                  label="카테고리"
                  value={category}
                  mode="outlined"
                  editable={false}
                  style={styles.categoryInput}
                  left={
                    <TextInput.Icon
                      icon={() => (
                        <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category] }]} />
                      )}
                    />
                  }
                  right={
                    <TextInput.Icon
                      icon={showCategoryMenu ? 'chevron-up' : 'chevron-down'}
                    />
                  }
                />
              </View>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setShowCategoryMenu((v) => !v)}
                activeOpacity={0.8}
              />
              {showCategoryMenu && (
                <View
                  style={[
                    styles.categoryDropdown,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
                  ]}
                >
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
                      <View style={[styles.menuDot, { backgroundColor: CATEGORY_COLORS[opt.value] }]} />
                      <Text style={[styles.categoryOptionText, { color: theme.colors.onSurface }]}>
                        {opt.value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {!isTimeValid && (
            <Text style={[styles.timeError, { color: theme.colors.error }]}>
              종료 시간은 시작 시간보다 늦어야 합니다
            </Text>
          )}
          {!isDateValid && (
            <Text style={[styles.timeError, { color: theme.colors.error }]}>
              종료 날짜는 시작 날짜 이후여야 해요
            </Text>
          )}

          {/* 인라인 날짜 선택 달력 */}
          {showDatePicker && (
            <View style={[styles.inlineDatePicker, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
              <MonthCalendar
                selectedDate={datePickerTarget === 'start' ? date : endDate}
                markedDates={{}}
                onDateSelect={(d) => {
                  if (datePickerTarget === 'start') {
                    setDate(d);
                    const newEnd = endDate < d ? d : endDate;
                    if (endDate < d) setEndDate(d);
                    // 다일→단일로 바뀐 경우 시각 복구
                    if (newEnd === d && (date !== endDate)) {
                      if (!startTime) setStartTime('09:00');
                      if (!endTime) setEndTime('10:00');
                    }
                  } else {
                    setEndDate(d);
                    if (d !== date) {
                      // 단일→다일: 시각 초기화 + 알람·반복 해제
                      setStartTime('');
                      setEndTime('');
                      setAlarmEnabled(false);
                      setAlarmTimes([]);
                      setRepeatEnabled(false);
                      setRepeat(undefined);
                      setRepeatUntil('');
                      setMinutesInput('');
                      setIsMinutesModeActive(false);
                      setRepeatAlarmTime('');
                    } else {
                      // 다일→단일: 시각 복구
                      if (!startTime) setStartTime('09:00');
                      if (!endTime) setEndTime('10:00');
                    }
                  }
                  setShowDatePicker(false);
                }}
                onMonthChange={() => {}}
              />
            </View>
          )}

          {/* 장소 + 작성자 — 한 줄 2분할 */}
          <View style={styles.doubleRow}>
            <TextInput
              label="장소"
              value={location}
              onChangeText={(v) => setLocation(v.trimStart())}
              mode="outlined"
              style={styles.halfInput}
              placeholder="장소 검색"
              maxLength={100}
              returnKeyType="search"
              onSubmitEditing={() => setShowLocationSearch(true)}
              right={<TextInput.Icon icon="magnify" onPress={() => setShowLocationSearch(true)} />}
            />
            <TextInput
              label="작성자"
              value={nameTag}
              onChangeText={setNameTag}
              mode="outlined"
              style={styles.halfInput}
              placeholder="내 이름"
              maxLength={10}
            />
          </View>

          {/* 장소 검색 모달 — 필요할 때만 마운트 */}
          {showLocationSearch && (
            <LocationSearchModal
              visible
              initialQuery={location}
              onSelect={(placeName) => {
                setLocation(placeName);
                setShowLocationSearch(false);
              }}
              onClose={() => setShowLocationSearch(false)}
            />
          )}

          {/* 메모 — 내용이 길면 자동으로 높이 확장 (scrollEnabled=false) */}
          <TextInput
            label="메모 (선택)"
            value={memo}
            onChangeText={(v) => setMemo(v.trimStart())}
            mode="outlined"
            style={[styles.input, styles.memoInput]}
            contentStyle={styles.memoContent}
            placeholder="메모를 입력하세요"
            multiline
            scrollEnabled={false}
            maxLength={300}
          />

          {/* ── 반복 설정 — 단일 날짜 일정에서만 표시 ─────── */}
          {date === endDate && (
            <>
              <Divider style={styles.divider} />
              {/* 반복 토글 행 */}
              <View style={styles.alarmRow}>
                <View style={styles.alarmLabelGroup}>
                  <Text style={[styles.alarmLabel, { color: theme.colors.onSurface }]}>반복</Text>
                  <Text style={[styles.alarmSub, { color: theme.colors.onSurfaceVariant }]}>
                    {repeatEnabled && repeat
                      ? isMinutesModeActive
                        ? `${minutesInput}분마다 반복`
                        : `${REPEAT_OPTIONS.find((o) => o.value === repeat)?.label} 반복`
                      : '반복 일정 설정'}
                  </Text>
                </View>
                <Switch
                  value={repeatEnabled}
                  onValueChange={(val) => {
                    setRepeatEnabled(val);
                    if (!val) {
                      setRepeat(undefined);
                      setRepeatUntil('');
                      setMinutesInput('');
                      setIsMinutesModeActive(false);
                      setRepeatAlarmTime('');
                      setShowRepeatUntilPicker(false);
                    }
                  }}
                  color={theme.colors.primary}
                />
              </View>

              {/* 반복 상세 영역 (토글 켰을 때만 표시) */}
              {repeatEnabled && (
                <View style={styles.repeatSection}>
                  <View style={styles.repeatChipRow}>
                    {REPEAT_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.value}
                        mode={repeat === opt.value ? 'flat' : 'outlined'}
                        selected={repeat === opt.value}
                        onPress={() => {
                          setRepeat((prev) => prev === opt.value ? undefined : opt.value);
                          setIsMinutesModeActive(false);
                          setMinutesInput('');
                        }}
                        compact
                        style={styles.repeatChip}
                      >
                        {opt.label}
                      </Chip>
                    ))}
                    {/* 테스트용: 분 단위 반복 */}
                    <Chip
                      mode={isMinutesModeActive ? 'flat' : 'outlined'}
                      selected={isMinutesModeActive}
                      onPress={() => {
                        if (isMinutesModeActive) {
                          // 분 모드 해제
                          setIsMinutesModeActive(false);
                          setRepeat(undefined);
                          setMinutesInput('');
                        } else {
                          // 분 모드 진입 (다른 반복 선택 해제)
                          setIsMinutesModeActive(true);
                          setRepeat(undefined);
                          setMinutesInput('');
                        }
                      }}
                      compact
                      style={styles.repeatChip}
                    >
                      N분마다
                    </Chip>
                  </View>

                  {/* 분 단위 입력 (N분마다 선택 시) */}
                  {isMinutesModeActive && (
                    <TextInput
                      label="반복 간격 (분)"
                      value={minutesInput}
                      onChangeText={(v) => {
                        setMinutesInput(v);
                        const num = parseInt(v, 10);
                        if (num > 0) setRepeat(`minutes:${num}`);
                        else setRepeat(undefined);
                      }}
                      mode="outlined"
                      keyboardType="numeric"
                      style={styles.repeatUntilInput}
                      placeholder="예: 5"
                      maxLength={4}
                    />
                  )}

                  {/* 알람 시각 + 반복 종료일 — 한 줄 2분할 */}
                  {(repeat || isMinutesModeActive) && (
                    <View>
                      <View style={styles.repeatTimeRow}>
                        <TimeInput
                          label={isMinutesModeActive ? '기준 시각' : '알람 시각'}
                          value={repeatAlarmTime}
                          onChange={setRepeatAlarmTime}
                          compact
                          style={styles.repeatHalfInput}
                        />
                        {repeat && !isMinutesModeActive && (
                          <TextInput
                            label="종료일 (선택)"
                            value={repeatUntil}
                            onChangeText={setRepeatUntil}
                            mode="outlined"
                            style={styles.repeatHalfInput}
                            placeholder="없으면 무한"
                            keyboardType="numeric"
                            maxLength={10}
                            right={
                              <TextInput.Icon
                                icon={showRepeatUntilPicker ? 'calendar-check' : 'calendar'}
                                onPress={() => setShowRepeatUntilPicker((v) => !v)}
                              />
                            }
                          />
                        )}
                      </View>
                      {showRepeatUntilPicker && (
                        <View style={[styles.inlineDatePicker, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
                          <MonthCalendar
                            selectedDate={repeatUntil || date}
                            markedDates={{}}
                            onDateSelect={(d) => {
                              setRepeatUntil(d);
                              setShowRepeatUntilPicker(false);
                            }}
                            onMonthChange={() => {}}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* 반복 활성 시 알람 섹션 숨김 (반복 섹션에서 알람 시각 직접 설정) */}
          {!repeatEnabled && (
          <>
          <Divider style={styles.divider} />

          {/* ── 알람 섹션 ────────────────────────── */}

          {/* 알람 토글 행 */}
          <View style={styles.alarmRow}>
            <View style={styles.alarmLabelGroup}>
              <Text style={[styles.alarmLabel, { color: canSetAlarm ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
                알람
              </Text>
              <Text style={[styles.alarmSub, { color: theme.colors.onSurfaceVariant }]}>
                {canSetAlarm ? '일정 전 알림 받기' : '시작·종료 시각을 입력해야 설정할 수 있어요'}
              </Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={handleAlarmToggle}
              color={theme.colors.primary}
              disabled={!canSetAlarm}
            />
          </View>

          {/* 알람 상세 영역 (알람 켰을 때만 표시) */}
          {alarmEnabled && (
            <View style={styles.alarmDetailSection}>

              {/* 등록된 알람 목록 */}
              {alarmTimes.map((mins) => (
                <View
                  key={mins}
                  style={[
                    styles.alarmTimeItem,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Text style={[styles.alarmTimeIcon, { color: theme.colors.primary }]}>
                    ○
                  </Text>
                  <Text style={[styles.alarmTimeText, { color: theme.colors.onSurface }]}>
                    {formatAlarmTime(mins)}
                  </Text>
                  <IconButton
                    icon="close"
                    size={16}
                    iconColor={theme.colors.onSurfaceVariant}
                    onPress={() => handleRemoveAlarm(mins)}
                    style={styles.removeAlarmBtn}
                  />
                </View>
              ))}

              {/* 알람 추가 패널 토글 */}
              {!showAddPanel ? (
                // 패널 닫힘: "+ 알람 추가" 버튼
                <TouchableOpacity
                  style={styles.addAlarmBtn}
                  onPress={() => setShowAddPanel(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.addAlarmBtnText, { color: theme.colors.primary }]}>
                    + 알람 추가
                  </Text>
                </TouchableOpacity>
              ) : (
                // 패널 열림: 프리셋 + 직접 입력
                <View
                  style={[
                    styles.addPanel,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
                  ]}
                >
                  {/* 빠른 선택 섹션 */}
                  <Text style={[styles.panelSectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                    빠른 선택
                  </Text>
                  <View style={styles.presetRow}>
                    {ALARM_PRESETS.map((preset) => {
                      const isSelected = alarmTimes.includes(preset.minutes);
                      return (
                        <Chip
                          key={preset.minutes}
                          mode={isSelected ? 'flat' : 'outlined'}
                          selected={isSelected}
                          onPress={() => handleAddPreset(preset.minutes)}
                          style={styles.presetChip}
                          compact
                        >
                          {preset.label}
                        </Chip>
                      );
                    })}
                  </View>

                  {/* 직접 입력 섹션 */}
                  <Text style={[styles.panelSectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                    직접 입력
                  </Text>
                  <View style={styles.customInputRow}>
                    {/* 숫자 입력 */}
                    <TextInput
                      value={customValue}
                      onChangeText={setCustomValue}
                      mode="outlined"
                      keyboardType="numeric"
                      placeholder="숫자"
                      style={styles.customInput}
                      dense
                    />

                    {/* 단위 선택 (분/시간/일) */}
                    <View style={styles.unitToggleRow}>
                      {TIME_UNITS.map((unit) => (
                        <TouchableOpacity
                          key={unit.value}
                          style={[
                            styles.unitBtn,
                            {
                              backgroundColor:
                                customUnit === unit.value
                                  ? theme.colors.primary
                                  : theme.colors.surface,
                              borderColor: theme.colors.outline,
                            },
                          ]}
                          onPress={() => setCustomUnit(unit.value)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.unitBtnText,
                              {
                                color:
                                  customUnit === unit.value
                                    ? theme.colors.onPrimary
                                    : theme.colors.onSurface,
                              },
                            ]}
                          >
                            {unit.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* 추가 버튼 */}
                    <Button
                      mode="contained"
                      onPress={handleAddCustom}
                      disabled={!customValue || parseInt(customValue, 10) <= 0}
                      compact
                      style={styles.customAddBtn}
                    >
                      추가
                    </Button>
                  </View>

                  {/* 취소 버튼 */}
                  <Button
                    mode="text"
                    onPress={() => {
                      setShowAddPanel(false);
                      setCustomValue('');
                    }}
                    style={styles.cancelPanelBtn}
                    labelStyle={{ color: theme.colors.onSurfaceVariant }}
                  >
                    취소
                  </Button>
                </View>
              )}
            </View>
          )}
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
              paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm,
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
              {isEditMode ? '수정 완료' : '일정 저장'}
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
    paddingTop: spacing.md,
  },
  input: {
    marginBottom: spacing.sm,
  },
  memoInput: {
    minHeight: 90,
  },
  memoContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  dateInput: {
    flex: 1,
  },
  timeInput: {
    flex: 1,
  },
  timeError: {
    fontSize: 12,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  timeSeparator: {
    fontSize: 15,
    fontWeight: '400',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  // 인라인 날짜 달력
  inlineDatePicker: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },

  // 카테고리 — 시간 행 내 드롭다운 래퍼
  categoryWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  categoryInput: {},

  // 장소 + 작성자 — 한 줄 2분할
  doubleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryDropdown: {
    position: 'absolute',
    top: '100%',       // categoryWrapper 높이 바로 아래 (Paper TextInput 높이 = 100%)
    left: 0,
    right: 0,
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 4,
    zIndex: 999,
    elevation: 4,
    overflow: 'hidden',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryOptionText: {
    fontSize: 14,
  },
  menuDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },


  divider: {
    marginVertical: spacing.sm,
  },

  // ── 반복 섹션 스타일 ──────────────────────────

  repeatSection: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  repeatLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  repeatChipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  repeatChip: {
    marginBottom: 0,
  },
  repeatUntilRow: {
    gap: spacing.xs,
  },
  repeatUntilInput: {},
  repeatTimeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  repeatHalfInput: {
    flex: 1,
  },

  // ── 알람 섹션 스타일 ──────────────────────────

  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  alarmLabelGroup: {
    gap: 1,
  },
  alarmLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  alarmSub: {
    fontSize: 11,
  },
  alarmDetailSection: {
    marginTop: 2,
    gap: spacing.xs,
  },

  // 등록된 알람 항목 한 행
  alarmTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    paddingLeft: spacing.sm,
    paddingVertical: 0,
    marginBottom: 3,
  },
  alarmTimeIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  alarmTimeText: {
    flex: 1,
    fontSize: 14,
  },
  removeAlarmBtn: {
    margin: 0,
    marginRight: 0,
  },

  // "+ 알람 추가" 버튼
  addAlarmBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignSelf: 'flex-start',
  },
  addAlarmBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // 알람 추가 패널
  addPanel: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  panelSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },

  // 프리셋 Chip 목록
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  presetChip: {
    marginBottom: 0,
  },

  // 직접 입력 행
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customInput: {
    width: 80,
  },

  // 단위 선택 버튼 3개 묶음
  unitToggleRow: {
    flexDirection: 'row',
    gap: 2,
  },
  unitBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customAddBtn: {
    marginLeft: spacing.xs,
  },

  // 패널 취소 버튼
  cancelPanelBtn: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
  },

  // ── 공통 ──────────────────────────────────────

  bottomPadding: {
    height: spacing.lg,
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
