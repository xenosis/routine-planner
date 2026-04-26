import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, ProgressBar, SegmentedButtons, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RoutineItem from '../../components/routine/RoutineItem';
import AddRoutineScreen from './AddRoutineScreen';
import { initDatabase } from '../../db/database';
import { useRoutineStore } from '../../store/routineStore';
import type { Routine } from '../../db/routineDb';
import { borderRadius, spacing } from '../../theme';

// 오늘 날짜 문자열 반환 (YYYY-MM-DD)
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "4월 9일" 형식으로 날짜 포맷
function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일`;
}

export default function RoutineScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    routines,
    completedIds,
    weekCompletions,
    fetchRoutines,
    fetchCompletions,
    fetchWeekCompletions,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    toggleCompletion,
  } = useRoutineStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');

  const today = getTodayString();

  // 마운트 시 DB 초기화 및 데이터 로드
  useEffect(() => {
    async function init() {
      await initDatabase();
      await fetchRoutines();
      await fetchCompletions(today);
      await fetchWeekCompletions();
    }
    init();
  }, []);

  // 오늘 요일 기준으로 표시할 루틴 필터링
  // daily → 항상 / weekly_days → 해당 요일만
  // weekly_count → quota 달성 AND 오늘 미체크 시 제외 (이미 이번 주 목표 달성)
  const todayDayOfWeek = useMemo(() => new Date().getDay(), []);

  const todayRoutines = useMemo(() => {
    return routines.filter((r) => {
      if (r.frequency === 'weekly_count') {
        const isQuotaMet = (weekCompletions[r.id]?.length ?? 0) >= (r.weeklyCount ?? 1);
        const isCheckedToday = completedIds.includes(r.id);
        if (isQuotaMet && !isCheckedToday) return false;
        return true;
      }
      if (r.frequency === 'daily') return true;
      return r.weekdays?.includes(todayDayOfWeek) ?? false;
    });
  }, [routines, todayDayOfWeek, weekCompletions, completedIds]);

  // weekly_count 루틴의 이번 주 quota 달성 여부 계산
  const getIsQuotaMet = useCallback((item: Routine): boolean => {
    if (item.frequency !== 'weekly_count' || !item.weeklyCount) return false;
    return (weekCompletions[item.id]?.length ?? 0) >= item.weeklyCount;
  }, [weekCompletions]);

  // 미완료 → 완료 순서로 정렬 (오늘 루틴 기준)
  const sortedRoutines = useMemo(() => {
    const completed = todayRoutines.filter((r) => completedIds.includes(r.id));
    const pending = todayRoutines.filter((r) => !completedIds.includes(r.id));
    return [...pending, ...completed];
  }, [todayRoutines, completedIds]);

  // 전체 루틴 목록 (내 루틴 관리 탭용, 등록 시간 순 정렬)
  const allRoutinesSorted = useMemo(() => {
    return [...routines].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [routines]);

  // 진행률 계산 (0 ~ 1)
  // todayRoutines에서 quota 달성+오늘 미체크 weekly_count는 이미 제외되어 있으므로
  // 단순히 completedIds 기준으로 계산
  const progress = useMemo(() => {
    if (todayRoutines.length === 0) return 0;
    const doneCount = todayRoutines.filter((r) => completedIds.includes(r.id)).length;
    return doneCount / todayRoutines.length;
  }, [todayRoutines, completedIds]);

  // FAB — 루틴 추가 모달 열기
  const handleFABPress = useCallback(() => {
    setEditingRoutine(undefined);
    setModalVisible(true);
  }, []);

  // 카드 탭 — 수정 모달 열기
  const handleItemPress = useCallback((routine: Routine) => {
    setEditingRoutine(routine);
    setModalVisible(true);
  }, []);

  // 카드 롱탭 or 삭제 버튼 — 삭제 확인 Alert
  const handleItemDelete = useCallback((routine: Routine) => {
    Alert.alert(
      '루틴 삭제',
      `"${routine.title}" 루틴을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => { await deleteRoutine(routine.id); },
        },
      ],
      { cancelable: true },
    );
  }, [deleteRoutine]);

  // 수정 모달에서 삭제
  const handleDeleteFromModal = useCallback(() => {
    if (!editingRoutine) return;
    Alert.alert(
      '루틴 삭제',
      `"${editingRoutine.title}" 루틴을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteRoutine(editingRoutine.id);
            setModalVisible(false);
            setEditingRoutine(undefined);
          },
        },
      ],
      { cancelable: true },
    );
  }, [editingRoutine, deleteRoutine]);

  // 체크 버튼 — 완료/취소 토글
  const handleToggle = useCallback(async (routineId: string) => {
    await toggleCompletion(routineId);
  }, [toggleCompletion]);

  // 저장 (추가/수정)
  const handleSave = useCallback(async (routine: Routine) => {
    if (editingRoutine) {
      await updateRoutine(routine);
    } else {
      await addRoutine(routine);
    }
    setModalVisible(false);
    setEditingRoutine(undefined);
  }, [editingRoutine, addRoutine, updateRoutine]);

  // 모달 닫기
  const handleClose = useCallback(() => {
    setModalVisible(false);
    setEditingRoutine(undefined);
  }, []);

  // 빈 상태 컴포넌트 (탭 컨텍스트 인식)
  function renderEmpty() {
    // 오늘 탭 + 루틴이 있지만 오늘 예정 없음
    const isTodayNoScheduled = activeTab === 'today' && routines.length > 0;
    const msg = isTodayNoScheduled
      ? { icon: 'calendar-today' as const, title: '오늘 예정된 루틴이 없어요', sub: '내 루틴 관리 탭에서 루틴을 확인하세요' }
      : { icon: 'plus-circle-outline' as const, title: '루틴을 추가해보세요', sub: '매일 반복할 루틴을 설정하고 스트릭을 쌓아보세요' };

    return (
      <TouchableOpacity
        style={styles.emptyContainer}
        onPress={isTodayNoScheduled ? undefined : handleFABPress}
        activeOpacity={isTodayNoScheduled ? 1 : 0.6}
        disabled={isTodayNoScheduled}
      >
        <MaterialCommunityIcons
          name={msg.icon}
          size={52}
          color={theme.colors.outline}
        />
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          {msg.title}
        </Text>
        <Text style={[styles.emptySubText, { color: theme.colors.outline }]}>
          {msg.sub}
        </Text>
      </TouchableOpacity>
    );
  }

  // 오늘 탭 아이템 렌더러 (체크 버튼 포함)
  const renderTodayItem = useCallback(({ item }: { item: Routine }) => (
    <RoutineItem
      routine={item}
      isCompleted={completedIds.includes(item.id)}
      weekCompletions={weekCompletions[item.id] ?? []}
      isQuotaMet={getIsQuotaMet(item)}
      showCheckButton
      onToggle={handleToggle}
      onPress={handleItemPress}
      onLongPress={handleItemDelete}
      onDelete={handleItemDelete}
    />
  ), [completedIds, weekCompletions, getIsQuotaMet, handleToggle, handleItemPress, handleItemDelete]);

  // 전체 탭 아이템 렌더러 (체크 버튼 없음, 탭하면 수정 모달)
  const renderAllItem = useCallback(({ item }: { item: Routine }) => (
    <RoutineItem
      routine={item}
      isCompleted={completedIds.includes(item.id)}
      weekCompletions={weekCompletions[item.id] ?? []}
      showCheckButton={false}
      onToggle={handleToggle}
      onPress={handleItemPress}
      onLongPress={handleItemDelete}
      onDelete={handleItemDelete}
    />
  ), [completedIds, weekCompletions, handleToggle, handleItemPress, handleItemDelete]);

  const keyExtractor = useCallback((item: Routine) => item.id, []);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >

      {/* 상단 헤더 카드 */}
      <Surface
        style={[
          styles.headerCard,
          { backgroundColor: theme.colors.surface },
        ]}
        elevation={1}
      >
        {/* 제목 행 */}
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            오늘의 루틴
          </Text>
          <Text style={[styles.headerDate, { color: theme.colors.onSurfaceVariant }]}>
            {formatDateShort(today)}
          </Text>
        </View>

        {/* 완료 카운트 (quota 달성+오늘 미체크 weekly_count는 todayRoutines에서 이미 제외) */}
        <Text style={[styles.completionCount, { color: theme.colors.onSurfaceVariant }]}>
          {todayRoutines.filter((r) => completedIds.includes(r.id)).length} / {todayRoutines.length} 완료
        </Text>

        {/* 진행률 바 */}
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}
        />
      </Surface>

      {/* 탭 버튼 */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'today' | 'all')}
        buttons={[
          { value: 'today', label: '오늘의 루틴' },
          { value: 'all', label: '내 루틴 관리' },
        ]}
        style={styles.tabButtons}
      />

      {/* 루틴 목록 */}
      <FlatList
        data={activeTab === 'today' ? sortedRoutines : allRoutinesSorted}
        keyExtractor={keyExtractor}
        renderItem={activeTab === 'today' ? renderTodayItem : renderAllItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          (activeTab === 'today' ? sortedRoutines : allRoutinesSorted).length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* 루틴 추가 FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={handleFABPress}
        accessibilityLabel="루틴 추가"
      />

      {/* 루틴 추가/수정 모달 */}
      <AddRoutineScreen
        visible={modalVisible}
        routine={editingRoutine}
        onSave={handleSave}
        onClose={handleClose}
        onDelete={editingRoutine ? handleDeleteFromModal : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // 상단 헤더 카드
  headerCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.base,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  completionCount: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: borderRadius.full,
  },
  // 탭 버튼
  tabButtons: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  // 리스트
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },
  // 빈 상태
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  emptySubText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    borderRadius: 28,
  },
});
