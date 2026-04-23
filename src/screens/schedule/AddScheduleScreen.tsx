import React, { useCallback, useLayoutEffect, useState } from 'react';
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
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing } from '../../theme';
import type { Schedule } from '../../db/scheduleDb';
import MonthCalendar from '../../components/calendar/MonthCalendar';
import { useAuthStore } from '../../store/authStore';

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

/**
 * 분 단위를 사람이 읽기 쉬운 문자열로 변환한다.
 * 예: 10 → "10분 전", 60 → "1시간 전", 1440 → "1일 전"
 */
function formatAlarmTime(minutes: number): string {
  if (minutes === 0) return '마감 시각';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${h === Math.floor(h) ? Math.floor(h) : h.toFixed(1)}시간 전`;
  }
  if (minutes < 10080) {
    const d = minutes / 1440;
    return `${d === Math.floor(d) ? Math.floor(d) : d.toFixed(1)}일 전`;
  }
  const w = minutes / 10080;
  return `${w === Math.floor(w) ? Math.floor(w) : w.toFixed(1)}주 전`;
}

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

/**
 * 복수 알람 예약 함수.
 * alarmTimes 배열의 각 항목에 대해 개별 알람을 {scheduleId}_{index} 식별자로 등록한다.
 */
async function scheduleAlarmNotifications(schedule: Schedule): Promise<void> {
  if (!schedule.alarm || !schedule.alarmTimes?.length) return;

  try {
    // 알람 권한 확인
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return;
    }

    const [year, month, day] = schedule.date.split('-').map(Number);
    const [hour, minute] = schedule.startTime.split(':').map(Number);

    // 수정 모드: 기존 알람을 전부 취소한 후 재등록
    // 구형 단일 알람 ID 취소
    await Notifications.cancelScheduledNotificationAsync(schedule.id).catch(() => {});
    // 신형 복수 알람 ID 취소 (최대 20개까지 시도)
    for (let i = 0; i < 20; i++) {
      await Notifications.cancelScheduledNotificationAsync(`${schedule.id}_${i}`).catch(() => {});
    }

    // 각 알람 시간마다 개별 알람 등록
    for (let i = 0; i < schedule.alarmTimes.length; i++) {
      const mins = schedule.alarmTimes[i];
      const triggerDate = new Date(year, month - 1, day, hour, minute);
      triggerDate.setMinutes(triggerDate.getMinutes() - mins);

      // 과거 시각이면 건너뜀
      if (triggerDate <= new Date()) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `${schedule.id}_${i}`,
        content: {
          title: schedule.title,
          body: mins === 0 ? '지금 일정이 시작됩니다' : `${formatAlarmTime(mins)} 일정이 있습니다`,
          data: { type: 'schedule' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: 'default',
        },
      });
    }
  } catch (e) {
    // 알람 예약 실패 시 조용히 무시 (UI 블로킹 방지)
    console.warn('알람 예약 실패:', e);
  }
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

  // 폼 상태
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<Schedule['category']>('개인');
  const [location, setLocation] = useState('');
  const [nameTag, setNameTag] = useState('');
  const [nameTagColor, setNameTagColor] = useState('');
  const [memo, setMemo] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(false);

  // UI 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end'>('start');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);

  // 복수 알람 상태
  const [alarmTimes, setAlarmTimes] = useState<number[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<TimeUnit>('min');

  // 수정 모드일 때 기존 데이터로 폼 초기화 (useLayoutEffect: 화면에 그려지기 전 상태 설정)
  useLayoutEffect(() => {
    if (!visible) return;
    if (schedule) {
      setTitle(schedule.title);
      setDate(schedule.date);
      setEndDate(schedule.endDate ?? schedule.date);
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setCategory(schedule.category);
      setLocation(schedule.location ?? '');
      setNameTag(schedule.nameTag ?? '');
      setNameTagColor(schedule.nameTagColor ?? '');
      setMemo(schedule.memo ?? '');
      setAlarmEnabled(schedule.alarm);
      setAlarmTimes(schedule.alarmTimes ?? []);
    } else {
      // 추가 모드 초기화
      setTitle('');
      setDate(initialDate);
      setEndDate(initialDate);
      setStartTime('09:00');
      setEndTime('10:00');
      setCategory('개인');
      setLocation('');
      setNameTag(displayName);
      setNameTagColor(nameColor);
      setMemo('');
      setAlarmEnabled(false);
      setAlarmTimes([]);
    }
    // 공통 UI 상태 초기화
    setShowDatePicker(false);
    setShowCategoryMenu(false);
    setShowLocationSearch(false);
    setShowAddPanel(false);
    setCustomValue('');
    setCustomUnit('min');
  }, [schedule, initialDate, visible]);

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
    (!startTime && !endTime) || (!!startTime && !!endTime && endTime >= startTime);
  const isDateValid = endDate >= date;
  const canSetAlarm = !!startTime && !!endTime;

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    if (startTime && endTime && endTime < startTime) return;
    if (endDate < date) return;

    // alarm 필드: 알람 활성화 AND 알람이 하나 이상 등록된 경우만 true
    const hasAlarm = alarmEnabled && alarmTimes.length > 0;

    const newSchedule: Schedule = {
      id: schedule?.id ?? generateId(),
      title: title.trim(),
      date,
      endDate: endDate !== date ? endDate : undefined,
      startTime,
      endTime,
      category,
      color: nameTagColor || CATEGORY_COLORS[category],
      memo: memo.trim() || undefined,
      alarm: hasAlarm,
      alarmTimes: hasAlarm ? alarmTimes : undefined,
      location: location.trim() || undefined,
      nameTag: nameTag.trim() || undefined,
      nameTagColor: nameTag.trim() ? (nameTagColor || undefined) : undefined,
    };

    // 알람 예약 (추가 또는 수정 시 모두 처리)
    if (newSchedule.alarm && newSchedule.alarmTimes?.length) {
      await scheduleAlarmNotifications(newSchedule);
    }

    onSave(newSchedule);
  }, [
    title, date, startTime, endTime, category,
    location, nameTag, nameTagColor, memo, alarmEnabled, alarmTimes, schedule, onSave,
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
                    setStartTime('');
                    setEndTime('');
                    setAlarmEnabled(false);
                    setAlarmTimes([]);
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
                      // 단일→다일: 시각 초기화 + 알람 해제
                      setStartTime('');
                      setEndTime('');
                      setAlarmEnabled(false);
                      setAlarmTimes([]);
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
              value={location || ' '}
              onChangeText={(v) => setLocation(v.trimStart())}
              mode="outlined"
              style={styles.halfInput}
              placeholder="장소 검색"
              maxLength={100}
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
