import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import {
  getTodos,
  insertTodo,
  updateTodo as dbUpdateTodo,
  deleteTodo as dbDeleteTodo,
  markTodoCompleted,
} from '../db/todoDb';

export type { Todo } from '../db/todoDb';
import type { Todo } from '../db/todoDb';

// ─────────────────────────────────────────────
// 알람 헬퍼 함수
// ─────────────────────────────────────────────

/**
 * 특정 할일에 등록된 모든 알람을 취소한다.
 * - 기본 알람 ID: {id}_0 ~ {id}_9 (마감 N분 전)
 * - 후속 알람 ID: {id}_late_0 ~ {id}_late_2 (+1일/+1주/+1달)
 * - 취소 실패 시 무시 (이미 발송·취소된 알람일 수 있음)
 */
async function cancelAllTodoAlarms(id: string): Promise<void> {
  // 구형 단일 알람 ID 취소 (하위 호환 보호)
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  // 기본 알람 취소 (최대 10개)
  for (let i = 0; i < 10; i++) {
    await Notifications.cancelScheduledNotificationAsync(`${id}_${i}`).catch(() => {});
  }
  // 후속 알람 취소 (+1일, +1주, +1달)
  for (let i = 0; i < 3; i++) {
    await Notifications.cancelScheduledNotificationAsync(`${id}_late_${i}`).catch(() => {});
  }
}

/**
 * 마감일·시간 문자열을 Date 객체로 변환한다.
 * KST(UTC+9) 로컬 타임 기준으로 해석한다.
 */
function parseDeadline(deadlineDate: string, deadlineTime: string): Date {
  const [year, month, day] = deadlineDate.split('-').map(Number);
  const [hour, minute] = deadlineTime.split(':').map(Number);
  // new Date(y, m-1, d, h, min)은 로컬 타임 기준으로 생성됨
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * 할일의 알람을 등록한다.
 *
 * 기본 알람:
 *   todo.alarmTimes 배열의 각 항목(분) → 마감 시각 - N분 전 DATE 트리거
 *   알람 ID = {id}_0, {id}_1, ...
 *
 * 후속 알람 (alarm === true일 때만):
 *   마감 +1일 → {id}_late_0
 *   마감 +1주 → {id}_late_1
 *   마감 +1달 → {id}_late_2
 *   body: "{제목} 마감이 지났어요. 할일을 완료했나요?"
 *
 * 과거 시각은 등록하지 않고 건너뜀.
 */
async function scheduleTodoAlarms(todo: Todo): Promise<void> {
  try {
    // 알람이 꺼져 있거나 alarmTimes가 없으면 후속 알람도 등록하지 않음
    if (!todo.alarm) return;

    // 알람 권한 확인 및 요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      // 권한 거부 시 알람 등록 불가 — 조용히 종료
      return;
    }

    const deadlineMs = parseDeadline(todo.deadlineDate, todo.deadlineTime).getTime();
    const now = Date.now();

    // ── 기본 알람: 마감 N분 전 ──────────────────
    if (todo.alarmTimes && todo.alarmTimes.length > 0) {
      for (let i = 0; i < todo.alarmTimes.length; i++) {
        const minutesBefore = todo.alarmTimes[i];
        const triggerMs = deadlineMs - minutesBefore * 60 * 1000;

        // 과거 시각은 건너뜀
        if (triggerMs <= now) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: `${todo.id}_${i}`,
          content: {
            title: todo.title,
            body: minutesBefore === 0 ? '지금 마감인 할일이 있습니다' : `${minutesBefore}분 후 마감인 할일이 있습니다`,
            sound: true,
            data: { type: 'todo' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(triggerMs),
            channelId: 'default',
          },
        });
      }
    }

    // ── 후속 알람: 마감 이후 독촉 알림 ──────────
    const lateOffsets: { label: string; ms: number }[] = [
      { label: '1일',  ms: 24 * 60 * 60 * 1000 },
      { label: '1주',  ms: 7 * 24 * 60 * 60 * 1000 },
      { label: '1달',  ms: 30 * 24 * 60 * 60 * 1000 },
    ];

    for (let i = 0; i < lateOffsets.length; i++) {
      const triggerMs = deadlineMs + lateOffsets[i].ms;

      // 과거 시각은 건너뜀
      if (triggerMs <= now) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `${todo.id}_late_${i}`,
        content: {
          title: todo.title,
          body: `${todo.title} 마감이 지났어요. 할일을 완료했나요?`,
          sound: true,
          data: { type: 'todo' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          channelId: 'default',
        },
      });
    }
  } catch (error) {
    // 알람 등록 실패 시 콘솔에 기록하고 계속 진행 (앱 크래시 방지)
    console.error('[todoStore] 알람 등록 실패:', error);
  }
}

// ─────────────────────────────────────────────
// 스토어 인터페이스
// ─────────────────────────────────────────────

interface TodoState {
  /** 현재 필터에 해당하는 할일 목록 */
  todos: Todo[];
  /** 표시 필터: 'active'(미완료) | 'completed'(완료) */
  filter: 'active' | 'completed';

  // ── 액션 ──────────────────────────────────

  /** 현재 filter로 할일 목록을 DB에서 불러온다. */
  fetchTodos: () => Promise<void>;

  /** 필터를 변경하고 해당 목록을 다시 로드한다. */
  setFilter: (filter: 'active' | 'completed') => Promise<void>;

  /** 새 할일을 추가하고 알람을 등록한다. */
  addTodo: (todo: Todo) => Promise<void>;

  /** 기존 할일을 수정한다. 기존 알람을 전부 취소하고 새 알람을 등록한다. */
  updateTodo: (todo: Todo) => Promise<void>;

  /** 할일을 삭제하고 관련 알람을 전부 취소한다. */
  deleteTodo: (id: string) => Promise<void>;

  /**
   * 할일 완료 상태를 토글한다.
   * - 완료로 변경 시: 알람 전부 취소
   * - 미완료로 되돌릴 시: 알람 다시 등록
   */
  toggleCompleted: (id: string) => Promise<void>;
}

// ─────────────────────────────────────────────
// Zustand 스토어
// ─────────────────────────────────────────────

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  filter: 'active',

  // ── 조회 ────────────────────────────────

  fetchTodos: async () => {
    const { filter } = get();
    const todos = await getTodos(filter);
    set({ todos });
  },

  // ── 필터 변경 ─────────────────────────────

  setFilter: async (filter: 'active' | 'completed') => {
    set({ filter });
    // 필터 변경 후 즉시 목록 갱신
    const todos = await getTodos(filter);
    set({ todos });
  },

  // ── 추가 ───────────────────────────────

  addTodo: async (todo: Todo) => {
    await insertTodo(todo);
    // 알람 등록 (alarm: true이고 alarmTimes가 있을 때만 실제 동작)
    await scheduleTodoAlarms(todo);
    await get().fetchTodos();
  },

  // ── 수정 ───────────────────────────────

  updateTodo: async (todo: Todo) => {
    // 수정 전: 기존 알람 전부 취소
    await cancelAllTodoAlarms(todo.id);
    // DB 업데이트
    await dbUpdateTodo(todo);
    // 새 알람 등록 (완료 상태가 아닐 때만)
    if (!todo.completed) {
      await scheduleTodoAlarms(todo);
    }
    await get().fetchTodos();
  },

  // ── 삭제 ───────────────────────────────

  deleteTodo: async (id: string) => {
    // 알람 전부 취소
    await cancelAllTodoAlarms(id);
    await dbDeleteTodo(id);
    await get().fetchTodos();
  },

  // ── 완료 토글 ─────────────────────────────

  toggleCompleted: async (id: string) => {
    const target = get().todos.find((t) => t.id === id);
    if (!target) return;

    const nowCompleted = !target.completed;

    if (nowCompleted) {
      // 완료로 변경: 알람 전부 취소 + DB 업데이트
      await cancelAllTodoAlarms(id);
      await markTodoCompleted(id, true, new Date().toISOString());
    } else {
      // 미완료로 되돌리기: DB 업데이트 + 알람 다시 등록
      await markTodoCompleted(id, false, undefined);
      // 최신 상태로 알람 재등록 (completedAt 제거된 todo 객체로 재구성)
      const restored: Todo = {
        ...target,
        completed: false,
        completedAt: undefined,
      };
      await scheduleTodoAlarms(restored);
    }

    await get().fetchTodos();
  },
}));
