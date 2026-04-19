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
  Chip,
  Divider,
  IconButton,
  Surface,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../theme';
import TimeInput from '../../components/common/TimeInput';
import type { Todo } from '../../db/todoDb';
import MonthCalendar from '../../components/calendar/MonthCalendar';

// 카테고리별 대표 색상 (일정과 동일 팔레트)
const CATEGORY_COLORS: Record<Todo['category'], string> = {
  '업무': '#6366F1',
  '개인': '#10B981',
  '건강': '#F59E0B',
  '기타': '#94A3B8',
};

// 알람 프리셋 (분 단위) — 마감 기준 N분 전
const ALARM_PRESETS = [
  { label: '10분', minutes: 10 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '3시간', minutes: 180 },
  { label: '1일', minutes: 1440 },
  { label: '2일', minutes: 2880 },
  { label: '1주', minutes: 10080 },
] as const;

// 직접 입력 단위
const TIME_UNITS = [
  { label: '분', value: 'min' as const },
  { label: '시간', value: 'hour' as const },
  { label: '일', value: 'day' as const },
] as const;

type TimeUnit = 'min' | 'hour' | 'day';

// 카테고리 선택 옵션
const CATEGORY_OPTIONS: Array<{ value: Todo['category']; label: string }> = [
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

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 새 할일용 고유 ID 생성
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

interface AddTodoScreenProps {
  visible: boolean;
  todo?: Todo;           // 수정 모드일 때 기존 데이터
  onSave: (todo: Todo) => void;
  onClose: () => void;
  onDelete?: () => void; // 수정 모드일 때만 전달
}

export default function AddTodoScreen({
  visible,
  todo,
  onSave,
  onClose,
  onDelete,
}: AddTodoScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isEditMode = Boolean(todo);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(getTodayString());
  const [deadlineTime, setDeadlineTime] = useState('09:00');
  const [category, setCategory] = useState<Todo['category']>('개인');
  const [memo, setMemo] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(false);

  // UI 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // 복수 알람 상태
  const [alarmTimes, setAlarmTimes] = useState<number[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<TimeUnit>('min');

  // 수정 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setDeadlineDate(todo.deadlineDate);
      setDeadlineTime(todo.deadlineTime ?? '');
      setCategory(todo.category);
      setMemo(todo.memo ?? '');
      setAlarmEnabled(todo.alarm);
      setAlarmTimes(todo.alarmTimes ?? []);
    } else {
      // 추가 모드 초기화
      setTitle('');
      setDeadlineDate(getTodayString());
      setDeadlineTime('09:00');
      setCategory('개인');
      setMemo('');
      setAlarmEnabled(false);
      setAlarmTimes([]);
    }
    // 공통 UI 상태 초기화
    setShowDatePicker(false);
    setShowCategoryMenu(false);
    setShowAddPanel(false);
    setCustomValue('');
    setCustomUnit('min');
  }, [todo, visible]);

  // 알람 토글 핸들러
  const handleAlarmToggle = useCallback((val: boolean) => {
    setAlarmEnabled(val);
    if (!val) {
      // 알람 끄면 등록된 알람 전부 초기화
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
  const handleSave = useCallback(async () => {
    if (!title.trim()) return; // 제목 필수

    // alarm 필드: 알람 활성화 AND 알람이 하나 이상 등록된 경우만 true
    const hasAlarm = alarmEnabled && alarmTimes.length > 0;

    const newTodo: Todo = {
      id: todo?.id ?? generateId(),
      title: title.trim(),
      deadlineDate,
      deadlineTime,
      category,
      color: CATEGORY_COLORS[category],
      memo: memo.trim() || undefined,
      alarm: hasAlarm,
      alarmTimes: hasAlarm ? alarmTimes : undefined,
      completed: todo?.completed ?? false,
      completedAt: todo?.completedAt,
      createdAt: todo?.createdAt ?? new Date().toISOString(),
    };

    // 알람 예약은 todoStore에서 처리 (addTodo/updateTodo 액션)
    onSave(newTodo);
  }, [
    title, deadlineDate, deadlineTime, category,
    memo, alarmEnabled, alarmTimes, todo, onSave,
  ]);

  const isSaveDisabled = !title.trim();

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
            {isEditMode ? '할일 수정' : '할일 추가'}
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
            placeholder="할일 제목을 입력하세요"
            maxLength={50}
            autoFocus={!isEditMode}
          />

          {/* 마감 날짜 */}
          <TextInput
            label="마감 날짜"
            value={deadlineDate}
            onChangeText={setDeadlineDate}
            mode="outlined"
            style={styles.input}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
            maxLength={10}
            right={
              <TextInput.Icon
                icon={showDatePicker ? 'calendar-check' : 'calendar'}
                onPress={() => setShowDatePicker((v) => !v)}
              />
            }
          />

          {/* 마감 시각 */}
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            마감 시각
          </Text>
          <TimeInput value={deadlineTime} onChange={setDeadlineTime} icon="clock-outline" />

          {/* 인라인 날짜 선택 달력 */}
          {showDatePicker && (
            <View
              style={[
                styles.inlineDatePicker,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <MonthCalendar
                selectedDate={deadlineDate}
                markedDates={{}}
                onDateSelect={(d) => {
                  setDeadlineDate(d);
                  setShowDatePicker(false);
                }}
                onMonthChange={() => {}}
              />
            </View>
          )}

          {/* 카테고리 — 단독 행 (Paper TextInput + 투명 오버레이) */}
          <View style={[styles.categoryWrapper, showCategoryMenu && { zIndex: 10 }]}>
            {/* pointerEvents="none": TextInput이 포커스를 가져가지 않도록 차단 */}
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
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: CATEGORY_COLORS[category] },
                        ]}
                      />
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

            {/* 터치 가로채기 오버레이 */}
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setShowCategoryMenu((v) => !v)}
              activeOpacity={0.8}
            />

            {/* 드롭다운 */}
            {showCategoryMenu && (
              <View
                style={[
                  styles.categoryDropdown,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outline,
                  },
                ]}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.categoryOption,
                      opt.value === category && {
                        backgroundColor: theme.colors.primaryContainer,
                      },
                    ]}
                    onPress={() => {
                      setCategory(opt.value);
                      setShowCategoryMenu(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.menuDot,
                        { backgroundColor: CATEGORY_COLORS[opt.value] },
                      ]}
                    />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {opt.value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 메모 */}
          <TextInput
            label="메모 (선택)"
            value={memo}
            onChangeText={setMemo}
            mode="outlined"
            style={[styles.input, styles.memoInput]}
            placeholder="메모를 입력하세요"
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          <Divider style={styles.divider} />

          {/* ── 알람 섹션 ────────────────────────── */}

          {/* 알람 토글 행 */}
          <View style={styles.alarmRow}>
            <View style={styles.alarmLabelGroup}>
              <Text style={[styles.alarmLabel, { color: theme.colors.onSurface }]}>
                알람
              </Text>
              <Text style={[styles.alarmSub, { color: theme.colors.onSurfaceVariant }]}>
                마감 전 알림 받기
              </Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={handleAlarmToggle}
              color={theme.colors.primary}
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
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  {/* 빠른 선택 섹션 */}
                  <Text
                    style={[
                      styles.panelSectionLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
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
                  <Text
                    style={[
                      styles.panelSectionLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
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
              style={[
                styles.saveButton,
                isEditMode && onDelete ? styles.saveButtonPartial : styles.saveButtonFull,
              ]}
              contentStyle={styles.footerButtonContent}
              labelStyle={styles.footerButtonLabel}
            >
              {isEditMode ? '수정 완료' : '할일 저장'}
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  memoInput: {
    minHeight: 90,
  },
  // 인라인 날짜 달력
  inlineDatePicker: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  // 카테고리 — 단독 행 래퍼
  categoryWrapper: {
    marginBottom: spacing.sm,
    zIndex: 1,
  },
  categoryInput: {
    // Paper TextInput 기본값 사용
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryDropdown: {
    position: 'absolute',
    top: '100%',
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
  // ── 알람 섹션 ──────────────────────────────
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
  },
  addAlarmBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignSelf: 'flex-start',
  },
  addAlarmBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  presetChip: {
    marginBottom: 0,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customInput: {
    width: 80,
  },
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
  cancelPanelBtn: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
  },
  // ── 공통 ──────────────────────────────────
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
