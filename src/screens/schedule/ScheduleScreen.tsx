import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MonthCalendar from '../../components/calendar/MonthCalendar';
import ScheduleItem from '../../components/schedule/ScheduleItem';
import AddScheduleScreen from './AddScheduleScreen';
import { initDatabase } from '../../db/database';
import { useScheduleStore } from '../../store/scheduleStore';
import type { Schedule } from '../../db/scheduleDb';
import { spacing } from '../../theme';
import { toLocalDateStr } from '../../utils/date';

// ─────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 ${dayNames[date.getDay()]}요일`;
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월 일정`;
}

// 월 전체 보기 시 날짜 구분 레이블 포맷
function formatDateSeparator(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const today = toLocalDateStr();
  const prefix = dateStr === today ? '오늘 · ' : '';
  return `${prefix}${m}월 ${d}일 ${dayNames[date.getDay()]}`;
}

// ─────────────────────────────────────────────
// 리스트 아이템 타입 (날짜 구분자 + 일정)
// ─────────────────────────────────────────────

type ListItem =
  | { kind: 'separator'; dateStr: string; key: string }
  | { kind: 'schedule'; schedule: Schedule; key: string };

function buildListItems(schedules: Schedule[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const s of schedules) {
    if (s.date !== lastDate) {
      items.push({ kind: 'separator', dateStr: s.date, key: `sep-${s.date}` });
      lastDate = s.date;
    }
    items.push({ kind: 'schedule', schedule: s, key: `${s.id}_${s.date}` });
  }
  return items;
}

// 아이템 높이 추정값 (scrollToOffset 계산용)
// 실제 렌더 높이와 근사치이며, 첫 번째 미래 일정 근처로 스크롤하는 용도로 충분하다.
const SEPARATOR_HEIGHT = 36;   // marginTop(12) + text(18) + marginBottom(4) + gap
const SCHEDULE_ITEM_HEIGHT = 74; // Surface minHeight(56) + padding(~10) + marginBottom(8)

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export default function ScheduleScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    schedules, selectedDate, viewYear, viewMonth, markedDates, rangeEvents,
    setSelectedDate, clearSelectedDate,
    fetchByDate, fetchByMonth, fetchMarkedDates,
    addSchedule, updateSchedule, deleteSchedule,
    setupRealtimeSubscription,
  } = useScheduleStore();

  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<Schedule | undefined>(undefined);

  /** 월 전체 보기용 FlatList ref (자동 스크롤에 사용) */
  const monthListRef = useRef<FlatList<ListItem>>(null);

  // 초기 데이터 로드
  useEffect(() => {
    async function init() {
      await initDatabase();
      const today = toLocalDateStr();
      const [year, month] = today.split('-').map(Number);
      await fetchByDate(today);
      await fetchMarkedDates(year, month);
    }
    init();
  }, []);

  // 실시간 구독: 상대방이 일정을 변경하면 자동 갱신
  useEffect(() => {
    const channel = setupRealtimeSubscription();
    return () => { channel.unsubscribe(); };
  }, [setupRealtimeSubscription]);

  // ── 달력 이벤트 핸들러 ───────────────────

  /** 날짜 셀 탭: 해당 날짜 선택 → 당일 일정 표시 */
  const handleDateSelect = useCallback(async (date: string) => {
    // 이미 선택된 날짜를 다시 탭하면 선택 해제 → 월 전체 보기
    if (date === selectedDate) {
      await clearSelectedDate();
    } else {
      setSelectedDate(date);
    }
  }, [selectedDate, setSelectedDate, clearSelectedDate]);

  /** 월 변경 (화살표 or 스와이프): 날짜 선택 해제 → 해당 월 전체 표시 */
  const handleMonthChange = useCallback(async (year: number, month: number) => {
    await fetchMarkedDates(year, month);
    // 선택된 날짜가 있으면 해제하고 월 전체 보기로 전환
    // (선택 해제는 store.clearSelectedDate가 현재 viewYear/viewMonth 기준으로 동작하므로
    //  직접 fetchByMonth를 호출해 새 연/월 기준으로 로드)
    useScheduleStore.setState({ selectedDate: null, viewYear: year, viewMonth: month });
    await fetchByMonth(year, month);
  }, [fetchMarkedDates, fetchByMonth]);

  // ── FAB / 모달 핸들러 ────────────────────

  const handleFABPress = useCallback(() => {
    setEditingSchedule(undefined);
    setModalVisible(true);
  }, []);

  const handleItemPress = useCallback((schedule: Schedule) => {
    setEditingSchedule(schedule);
    setModalVisible(true);
  }, []);

  // 카드 롱탭 or 삭제 버튼 — 삭제 확인 Alert
  const handleItemDelete = useCallback((schedule: Schedule) => {
    Alert.alert(
      '일정 삭제',
      `"${schedule.title}" 일정을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: async () => { await deleteSchedule(schedule.id); } },
      ],
      { cancelable: true },
    );
  }, [deleteSchedule]);

  // 수정 모달에서 삭제
  const handleDeleteFromModal = useCallback(() => {
    if (!editingSchedule) return;
    Alert.alert(
      '일정 삭제',
      `"${editingSchedule.title}" 일정을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteSchedule(editingSchedule.id);
            setModalVisible(false);
            setEditingSchedule(undefined);
          },
        },
      ],
      { cancelable: true },
    );
  }, [editingSchedule, deleteSchedule]);

  const handleSave = useCallback(async (schedule: Schedule) => {
    try {
      if (editingSchedule) {
        await updateSchedule(schedule);
      } else {
        await addSchedule(schedule);
      }
      setModalVisible(false);
      setEditingSchedule(undefined);
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    }
  }, [editingSchedule, addSchedule, updateSchedule]);

  const handleClose = useCallback(() => {
    setModalVisible(false);
    setEditingSchedule(undefined);
  }, []);

  // ── 렌더링 데이터 준비 ───────────────────

  const isMonthView = selectedDate === null;

  // 월 전체 보기일 때: 날짜 구분자 포함한 리스트 구성
  const listItems: ListItem[] = useMemo(
    () => (isMonthView ? buildListItems(schedules) : []),
    [isMonthView, schedules],
  );

  // 월 전체 보기로 전환될 때: 오늘 이후 첫 번째 구분자까지의 오프셋을 계산하여 자동 스크롤
  useEffect(() => {
    if (!isMonthView || listItems.length === 0) return;

    const currentToday = toLocalDateStr();
    let offset = 0;
    let foundFuture = false;

    for (const item of listItems) {
      if (item.kind === 'separator' && item.dateStr >= currentToday) {
        foundFuture = true;
        break;
      }
      offset += item.kind === 'separator' ? SEPARATOR_HEIGHT : SCHEDULE_ITEM_HEIGHT;
    }

    // 오늘 이후 일정이 있고, 스크롤이 필요한 경우에만 실행
    if (foundFuture && offset > 0) {
      // FlatList가 렌더된 후 스크롤 (짧은 지연)
      const timer = setTimeout(() => {
        monthListRef.current?.scrollToOffset({ offset, animated: false });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isMonthView, listItems]);

  // 날짜 레이블
  const dateLabel = isMonthView
    ? formatMonthLabel(viewYear, viewMonth)
    : formatDayLabel(selectedDate);

  // 초기 표시용 날짜 (AddScheduleScreen의 기본값)
  const today = toLocalDateStr();
  const defaultDate = selectedDate ?? today;

  // ── 빈 화면 ─────────────────────────────

  function renderEmpty() {
    const msg = isMonthView ? '이번 달 예정된 일정이 없어요' : '이날 일정이 없어요';
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={theme.colors.outline} />
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          {msg}
        </Text>
        <Text style={[styles.emptySubText, { color: theme.colors.outline }]}>
          + 버튼으로 일정을 추가해 보세요
        </Text>
      </View>
    );
  }

  // ── 리스트 아이템 렌더 ───────────────────

  /** 월 전체 보기용: 날짜 구분자 + 일정 카드 */
  const renderMonthItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'separator') {
      return (
        <Text style={[styles.dateSeparator, { color: theme.colors.onSurfaceVariant }]}>
          {formatDateSeparator(item.dateStr)}
        </Text>
      );
    }
    return (
      <ScheduleItem
        schedule={item.schedule}
        onPress={handleItemPress}
        onLongPress={handleItemDelete}
        onDelete={handleItemDelete}
      />
    );
  }, [theme.colors.onSurfaceVariant, handleItemPress, handleItemDelete]);

  /** 날짜 선택 보기용: 단순 일정 카드 목록 */
  const renderDayItem = useCallback(({ item }: { item: Schedule }) => (
    <ScheduleItem
      schedule={item}
      onPress={handleItemPress}
      onLongPress={handleItemDelete}
      onDelete={handleItemDelete}
    />
  ), [handleItemPress, handleItemDelete]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* 달력 */}
      <View style={styles.calendarWrapper}>
        <MonthCalendar
          selectedDate={selectedDate}
          markedDates={markedDates}
          rangeEvents={rangeEvents}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
        />
      </View>

      {/* 날짜/월 레이블 */}
      <View style={styles.dateLabelRow}>
        <Text style={[styles.dateLabel, { color: theme.colors.onBackground }]}>
          {dateLabel}
        </Text>
        <Text style={[styles.scheduleCount, { color: theme.colors.onSurfaceVariant }]}>
          총 {schedules.length}개
        </Text>
      </View>

      {/* 일정 목록 */}
      {isMonthView ? (
        <FlatList
          ref={monthListRef}
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderMonthItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            listItems.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          renderItem={renderDayItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            schedules.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 날짜 선택 시: 월 전체 보기 버튼 */}
      {!isMonthView && (
        <TouchableOpacity
          style={[styles.monthViewBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
          onPress={clearSelectedDate}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.monthViewBtnText, { color: theme.colors.onSurfaceVariant }]}>
            월 전체 일정 보기
          </Text>
        </TouchableOpacity>
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={handleFABPress}
      />

      {/* 일정 추가/수정 모달 — 열릴 때만 마운트해서 초기값을 올바르게 설정 */}
      {modalVisible && (
        <AddScheduleScreen
          visible={true}
          initialDate={defaultDate}
          schedule={editingSchedule}
          onSave={handleSave}
          onClose={handleClose}
          onDelete={editingSchedule ? handleDeleteFromModal : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  calendarWrapper: { marginHorizontal: spacing.base, marginTop: spacing.base },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  dateLabel: { fontSize: 15, fontWeight: '700' },
  scheduleCount: { fontSize: 12 },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: 100 },
  listContentEmpty: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: spacing.sm,
  },
  emptyText: { fontSize: 15, fontWeight: '600', marginTop: spacing.sm },
  emptySubText: { fontSize: 13 },
  dateSeparator: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingLeft: 2,
  },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, borderRadius: 28 },
  monthViewBtn: {
    position: 'absolute',
    bottom: spacing.xl + 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
  },
  monthViewBtnText: { fontSize: 13, fontWeight: '600' },
});
