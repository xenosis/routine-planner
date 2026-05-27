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
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing } from '../../theme';
import TimeInput from '../../components/common/TimeInput';
import type { Todo } from '../../db/todoDb';
import MonthCalendar from '../../components/calendar/MonthCalendar';
import { toLocalDateStr, generateId } from '../../utils/date';
import { getCategoryColor } from '../../utils/categoryUtils';
import { useCategoryStore } from '../../store/categoryStore';
import AlarmSection from '../../components/common/AlarmSection';

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

  const todoCategories = useCategoryStore((s) => s.todoCategories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);

  // 카테고리 목록 로드 (스토어가 비어 있을 때만)
  useEffect(() => {
    if (todoCategories.length === 0) {
      fetchCategories('todo');
    }
  }, [todoCategories.length, fetchCategories]);

  // 기본 카테고리: 로드된 목록의 첫 번째 또는 '개인'
  const defaultCategory = todoCategories[0]?.name ?? '개인';

  // 폼 상태
  const [title, setTitle] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(toLocalDateStr());
  const [deadlineTime, setDeadlineTime] = useState('09:00');
  const [category, setCategory] = useState<string>(defaultCategory);
  const [memo, setMemo] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(false);

  // UI 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const [alarmTimes, setAlarmTimes] = useState<number[]>([]);

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
      setDeadlineDate(toLocalDateStr());
      setDeadlineTime('09:00');
      setCategory(defaultCategory);
      setMemo('');
      setAlarmEnabled(false);
      setAlarmTimes([]);
    }
    setShowDatePicker(false);
    setShowCategoryMenu(false);
  }, [todo, visible]);

  const handleAlarmToggle = useCallback((val: boolean) => {
    setAlarmEnabled(val);
    if (val) {
      setAlarmTimes((prev) => prev.length === 0 ? [0] : prev);
    } else {
      setAlarmTimes([]);
    }
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
      color: getCategoryColor(category, todoCategories),
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

          {/* 마감 날짜 + 시각 — 한 줄 배치 */}
          <View style={styles.deadlineRow}>
            <TextInput
              label="마감 날짜"
              value={deadlineDate}
              onChangeText={setDeadlineDate}
              mode="outlined"
              style={styles.deadlineDateInput}
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
            <TimeInput
              value={deadlineTime}
              onChange={setDeadlineTime}
              compact
              label="마감 시각"
              style={styles.deadlineTimeInput}
            />
          </View>

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
                          { backgroundColor: getCategoryColor(category, todoCategories) },
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
                {todoCategories.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.categoryOption,
                      opt.name === category && {
                        backgroundColor: theme.colors.primaryContainer,
                      },
                    ]}
                    onPress={() => {
                      setCategory(opt.name);
                      setShowCategoryMenu(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.menuDot,
                        { backgroundColor: opt.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {opt.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

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

          {alarmEnabled && (
            <AlarmSection alarmTimes={alarmTimes} onAlarmTimesChange={setAlarmTimes} />
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
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  deadlineDateInput: {
    flex: 1.6,
  },
  deadlineTimeInput: {
    flex: 1,
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
  memoContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
