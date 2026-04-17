import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import {
  getAllRoutines,
  getCompletedIds,
  insertRoutine,
  updateRoutine as dbUpdateRoutine,
  deleteRoutine as dbDeleteRoutine,
  toggleCompletion as dbToggleCompletion,
  calculateStreak,
  updateStreak,
  getWeekCompletions,
} from '../db/routineDb';

// Routine 타입을 스토어 파일에서도 re-export하여 UI 레이어가 단일 진입점으로 사용 가능하게 한다.
export type { Routine } from '../db/routineDb';
import type { Routine } from '../db/routineDb';

// ─────────────────────────────────────────────
// 스토어 인터페이스
// ─────────────────────────────────────────────

interface RoutineState {
  /** 전체 루틴 목록 */
  routines: Routine[];
  /** 선택된 날짜에 완료된 루틴 id 목록 */
  completedIds: string[];
  /** 현재 선택된 날짜 (YYYY-MM-DD), 기본값: 오늘 */
  selectedDate: string;
  /** 이번 주(월~일) 완료 기록: routineId → 완료된 날짜 배열 */
  weekCompletions: Record<string, string[]>;

  // ── 액션 ──────────────────────────────────

  /** 전체 루틴 목록을 DB에서 불러와 routines를 갱신한다. */
  fetchRoutines: () => Promise<void>;

  /** 특정 날짜의 완료된 루틴 id 목록을 DB에서 불러온다. */
  fetchCompletions: (date: string) => Promise<void>;

  /** 이번 주 완료 기록을 DB에서 불러온다. */
  fetchWeekCompletions: () => Promise<void>;

  /** 새 루틴을 추가하고 routines를 갱신한다. */
  addRoutine: (routine: Routine) => Promise<void>;

  /** 기존 루틴을 수정하고 routines를 갱신한다. */
  updateRoutine: (routine: Routine) => Promise<void>;

  /** 루틴을 삭제하고 routines와 completedIds를 갱신한다. */
  deleteRoutine: (id: string) => Promise<void>;

  /**
   * 선택된 날짜의 루틴 완료 상태를 토글한다.
   * 토글 후 스트릭을 재계산하고 routines + completedIds + weekCompletions를 갱신한다.
   */
  toggleCompletion: (routineId: string) => Promise<void>;
}

// ─────────────────────────────────────────────
// Zustand 스토어 생성
// ─────────────────────────────────────────────

export const useRoutineStore = create<RoutineState>((set, get) => ({
  routines: [],
  completedIds: [],
  // 오늘 날짜를 기본 선택값으로 설정 (KST 기준 YYYY-MM-DD)
  selectedDate: new Date().toISOString().split('T')[0],
  weekCompletions: {},

  // ── 조회 ────────────────────────────────────

  fetchRoutines: async () => {
    const routines = await getAllRoutines();
    set({ routines });
    // 루틴 목록 갱신 후 이번 주 완료 현황도 함께 갱신
    await get().fetchWeekCompletions();
  },

  fetchCompletions: async (date: string) => {
    const completedIds = await getCompletedIds(date);
    set({ completedIds });
  },

  fetchWeekCompletions: async () => {
    // 이번 주 월요일(weekStart) ~ 일요일(weekEnd) 계산
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0=일
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - daysFromMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const result = await getWeekCompletions(fmt(monday), fmt(sunday));
    set({ weekCompletions: result });
  },

  // ── 추가 ────────────────────────────────────

  addRoutine: async (routine: Routine) => {
    await insertRoutine(routine);
    await get().fetchRoutines();
  },

  // ── 수정 ────────────────────────────────────

  updateRoutine: async (routine: Routine) => {
    await dbUpdateRoutine(routine);
    await get().fetchRoutines();
  },

  // ── 삭제 ────────────────────────────────────

  deleteRoutine: async (id: string) => {
    // 기존 daily 알람 취소
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    // weekly_days 알람 취소 (각 요일별 id 패턴: {id}_{jsDay})
    for (let day = 0; day <= 6; day++) {
      await Notifications.cancelScheduledNotificationAsync(`${id}_${day}`).catch(() => {});
    }
    await dbDeleteRoutine(id);
    // 삭제 후 루틴 목록과 완료 목록을 모두 갱신
    const { selectedDate } = get();
    await Promise.all([
      get().fetchRoutines(),
      get().fetchCompletions(selectedDate),
    ]);
  },

  // ── 완료 토글 ────────────────────────────────

  toggleCompletion: async (routineId: string) => {
    const { selectedDate } = get();
    const routine = get().routines.find(r => r.id === routineId);

    // weekly_count: quota 달성 + 오늘 미체크 상태면 추가 체크 불가
    if (routine?.frequency === 'weekly_count' && routine.weeklyCount) {
      const thisWeekDone = get().weekCompletions[routineId]?.length ?? 0;
      const alreadyToday = get().completedIds.includes(routineId);
      if (thisWeekDone >= routine.weeklyCount && !alreadyToday) return;
    }

    // 1. 완료 상태 토글 (DB)
    await dbToggleCompletion(routineId, selectedDate);

    // 2. 스트릭 재계산 (frequency별 파라미터 전달)
    const newStreak = await calculateStreak(
      routineId,
      routine?.frequency === 'weekly_days' ? routine.weekdays : undefined,
      routine?.frequency === 'weekly_count' ? routine.weeklyCount : undefined,
    );
    await updateStreak(routineId, newStreak);

    // 3. routines + completedIds + weekCompletions 동시 갱신
    await Promise.all([
      get().fetchRoutines(),
      get().fetchCompletions(selectedDate),
    ]);
    await get().fetchWeekCompletions();
  },
}));
