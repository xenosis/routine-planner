import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, SegmentedButtons, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TodoItem from '../../components/todo/TodoItem';
import AddTodoScreen from './AddTodoScreen';
import { useTodoStore } from '../../store/todoStore';
import type { Todo } from '../../db/todoDb';
import { spacing, borderRadius } from '../../theme';

// ─────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────

/**
 * 날짜 문자열(YYYY-MM-DD) 기준으로 진행중 탭의 날짜 구분 카테고리를 반환한다.
 * - '지남': 마감 초과
 * - '오늘': 오늘 마감
 * - '내일': 내일 마감
 * - '이번 주': 7일 이내 미래 (내일 제외)
 * - '그 이후': 7일 초과 미래
 */
function getDateGroup(deadlineDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = deadlineDate.split('-').map(Number);
  const deadline = new Date(y, m - 1, d);
  deadline.setHours(0, 0, 0, 0);

  const diffMs = deadline.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '지남';
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '내일';
  if (diffDays <= 7) return '이번 주';
  return '그 이후';
}

// 날짜 그룹 표시 순서 (상단에서 긴급도 순)
const DATE_GROUP_ORDER = ['지남', '오늘', '내일', '이번 주', '그 이후'];

// ─────────────────────────────────────────────
// 리스트 아이템 타입 (날짜 구분자 + 할일)
// ─────────────────────────────────────────────

type ListItem =
  | { kind: 'separator'; label: string; key: string }
  | { kind: 'todo'; todo: Todo; key: string };

/**
 * 진행중 탭 리스트 구성: 날짜 그룹별로 구분자를 삽입한다.
 * DB에서 마감일 오름차순으로 정렬되어 오므로 그룹 전환 시점에만 구분자를 추가한다.
 */
function buildActiveListItems(todos: Todo[]): ListItem[] {
  const items: ListItem[] = [];
  let lastGroup = '';

  for (const todo of todos) {
    const group = getDateGroup(todo.deadlineDate);
    if (group !== lastGroup) {
      items.push({ kind: 'separator', label: group, key: `sep-${group}` });
      lastGroup = group;
    }
    items.push({ kind: 'todo', todo, key: todo.id });
  }

  return items;
}

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export default function TodoScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    todos,
    filter,
    fetchTodos,
    setFilter,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleCompleted,
  } = useTodoStore();

  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingTodo, setEditingTodo] = React.useState<Todo | undefined>(undefined);

  // 초기 로드: 진행중 할일 목록 불러오기
  useEffect(() => {
    fetchTodos();
  }, []);

  // ── 핸들러 ───────────────────────────────

  const handleFABPress = useCallback(() => {
    setEditingTodo(undefined);
    setModalVisible(true);
  }, []);

  const handleItemPress = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setModalVisible(true);
  }, []);

  const handleToggleComplete = useCallback((todo: Todo) => {
    toggleCompleted(todo.id);
  }, [toggleCompleted]);

  // 카드 삭제 버튼 — 확인 Alert 후 삭제
  const handleItemDelete = useCallback((todo: Todo) => {
    Alert.alert(
      '할일 삭제',
      `"${todo.title}" 할일을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => { await deleteTodo(todo.id); },
        },
      ],
      { cancelable: true },
    );
  }, [deleteTodo]);

  // 수정 모달에서 삭제
  const handleDeleteFromModal = useCallback(() => {
    if (!editingTodo) return;
    Alert.alert(
      '할일 삭제',
      `"${editingTodo.title}" 할일을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteTodo(editingTodo.id);
            setModalVisible(false);
            setEditingTodo(undefined);
          },
        },
      ],
      { cancelable: true },
    );
  }, [editingTodo, deleteTodo]);

  const handleSave = useCallback(async (todo: Todo) => {
    if (editingTodo) {
      await updateTodo(todo);
    } else {
      await addTodo(todo);
    }
    setModalVisible(false);
    setEditingTodo(undefined);
  }, [editingTodo, addTodo, updateTodo]);

  const handleClose = useCallback(() => {
    setModalVisible(false);
    setEditingTodo(undefined);
  }, []);

  // 필터 탭 전환 시 목록 다시 로드
  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as 'active' | 'completed');
  }, [setFilter]);

  // ── 렌더링 데이터 준비 ───────────────────

  const isActiveFilter = filter === 'active';

  // 진행중 탭: 날짜 구분자 포함 리스트, 완료 탭: Todo 그대로
  const activeListItems: ListItem[] = useMemo(
    () => (isActiveFilter ? buildActiveListItems(todos) : []),
    [isActiveFilter, todos],
  );

  // 진행중 탭에서 그룹 순서 정렬 (DB는 마감일 오름차순이지만 '지남' 그룹이 앞에 와야 함)
  const sortedActiveItems: ListItem[] = useMemo(() => {
    if (!isActiveFilter) return activeListItems;

    // 그룹별 아이템 분류
    const groups: Record<string, ListItem[]> = {};
    DATE_GROUP_ORDER.forEach((g) => { groups[g] = []; });

    let currentGroup = '';
    for (const item of activeListItems) {
      if (item.kind === 'separator') {
        currentGroup = item.label;
        groups[currentGroup] = groups[currentGroup] ?? [];
      } else {
        groups[currentGroup].push(item);
      }
    }

    // 순서대로 재조립 (비어있는 그룹은 건너뜀)
    const result: ListItem[] = [];
    for (const groupLabel of DATE_GROUP_ORDER) {
      const groupItems = groups[groupLabel];
      if (groupItems && groupItems.length > 0) {
        result.push({ kind: 'separator', label: groupLabel, key: `sep-${groupLabel}` });
        result.push(...groupItems);
      }
    }
    return result;
  }, [isActiveFilter, activeListItems]);

  // 진행중 할일 개수 (헤더 뱃지용)
  const activeTodoCount = useMemo(
    () => (isActiveFilter ? todos.length : 0),
    [isActiveFilter, todos.length],
  );

  // ── 빈 화면 ─────────────────────────────

  const renderEmpty = useCallback(() => {
    if (isActiveFilter) {
      return (
        <TouchableOpacity
          style={styles.emptyContainer}
          onPress={handleFABPress}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="checkbox-blank-circle-outline"
            size={48}
            color={theme.colors.outline}
          />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            할일을 추가해보세요
          </Text>
          <Text style={[styles.emptySubText, { color: theme.colors.outline }]}>
            탭하거나 + 버튼으로 추가하세요
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="check-circle-outline"
          size={48}
          color={theme.colors.outline}
        />
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          완료된 할일이 없어요
        </Text>
      </View>
    );
  }, [isActiveFilter, handleFABPress, theme.colors]);

  // ── 리스트 아이템 렌더 ───────────────────

  /** 진행중 탭: 날짜 구분자 + 할일 카드 */
  const renderActiveItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'separator') {
      return (
        <Text
          style={[styles.dateSeparator, { color: theme.colors.onSurfaceVariant }]}
        >
          {item.label}
        </Text>
      );
    }
    return (
      <TodoItem
        todo={item.todo}
        onPress={handleItemPress}
        onDelete={handleItemDelete}
        onToggleComplete={handleToggleComplete}
      />
    );
  }, [theme.colors.onSurfaceVariant, handleItemPress, handleItemDelete, handleToggleComplete]);

  /** 완료 탭: 할일 카드만 */
  const renderCompletedItem = useCallback(({ item }: { item: Todo }) => (
    <TodoItem
      todo={item}
      onPress={handleItemPress}
      onDelete={handleItemDelete}
      onToggleComplete={handleToggleComplete}
    />
  ), [handleItemPress, handleItemDelete, handleToggleComplete]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* 헤더 영역 */}
      <View style={styles.headerArea}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
            할일
          </Text>
          {/* 진행중 개수 뱃지 */}
          {isActiveFilter && todos.length > 0 && (
            <Surface
              style={[styles.countBadge, { backgroundColor: theme.colors.primaryContainer }]}
              elevation={0}
            >
              <Text style={[styles.countBadgeText, { color: theme.colors.onPrimaryContainer }]}>
                {activeTodoCount}
              </Text>
            </Surface>
          )}
        </View>
      </View>

      {/* 진행중 / 완료 필터 탭 */}
      <View style={styles.segmentWrapper}>
        <SegmentedButtons
          value={filter}
          onValueChange={handleFilterChange}
          buttons={[
            { value: 'active', label: '진행중' },
            { value: 'completed', label: '완료' },
          ]}
        />
      </View>

      {/* 할일 목록 */}
      {isActiveFilter ? (
        <FlatList
          data={sortedActiveItems}
          keyExtractor={(item) => item.key}
          renderItem={renderActiveItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            sortedActiveItems.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          renderItem={renderCompletedItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            todos.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — 진행중 탭에서만 표시 */}
      {isActiveFilter && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={handleFABPress}
        />
      )}

      {/* 할일 추가/수정 모달 */}
      <AddTodoScreen
        visible={modalVisible}
        todo={editingTodo}
        onSave={handleSave}
        onClose={handleClose}
        onDelete={editingTodo ? handleDeleteFromModal : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // 헤더
  headerArea: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  // 진행중 개수 뱃지
  countBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 필터 탭
  segmentWrapper: {
    paddingHorizontal: spacing.base,
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

  // 날짜 구분자
  dateSeparator: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingLeft: 2,
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
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  emptySubText: {
    fontSize: 13,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    borderRadius: 28,
  },
});
