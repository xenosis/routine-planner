import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  getSchedulesByDate,
  getSchedulesByMonth,
  getMarkedDates,
  getMultiDayEventsForMonth,
  insertSchedule,
  updateSchedule as dbUpdateSchedule,
  deleteSchedule as dbDeleteSchedule,
} from '../db/scheduleDb';
import { cancelRepeatAlarms } from '../utils/scheduleAlarms';

export type { Schedule } from '../db/scheduleDb';
import type { Schedule } from '../db/scheduleDb';

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYearMonth(date: string): { year: number; month: number } {
  const [yearStr, monthStr] = date.split('-');
  return { year: parseInt(yearStr, 10), month: parseInt(monthStr, 10) };
}

// ─────────────────────────────────────────────
// 스토어 인터페이스
// ─────────────────────────────────────────────

interface ScheduleState {
  /** 현재 표시 중인 일정 목록 (날짜 선택 시 당일, 미선택 시 해당 월 오늘 이후) */
  schedules: Schedule[];
  /**
   * 선택된 날짜 (YYYY-MM-DD).
   * null 이면 특정 날짜가 선택되지 않은 "월 전체 보기" 상태.
   */
  selectedDate: string | null;
  /** 현재 달력에서 보고 있는 연도 */
  viewYear: number;
  /** 현재 달력에서 보고 있는 월 (1~12) */
  viewMonth: number;
  /** 현재 표시 중인 월에 일정이 있는 날짜별 이름표 색상 배열 맵 (캘린더 dot 표시용) */
  markedDates: Record<string, string[]>;
  /** 현재 월에 걸쳐 있는 다중일 이벤트 목록 (달력 range bar 렌더링용) */
  rangeEvents: { startDate: string; endDate: string; color: string }[];

  // ── 액션 ──────────────────────────────────

  /** 날짜를 선택하고 해당 날짜의 일정을 로드한다. */
  setSelectedDate: (date: string) => void;

  /** 날짜 선택을 해제하고 현재 월 전체의 오늘 이후 일정을 로드한다. */
  clearSelectedDate: () => Promise<void>;

  /** 특정 날짜의 일정을 DB에서 불러온다. */
  fetchByDate: (date: string) => Promise<void>;

  /**
   * 특정 년/월에서 오늘 이후(포함) 일정을 날짜·시간 오름차순으로 불러온다.
   * 달력 월 이동 시 사용.
   */
  fetchByMonth: (year: number, month: number) => Promise<void>;

  /** 특정 년/월의 마킹된 날짜 목록을 DB에서 불러온다. */
  fetchMarkedDates: (year: number, month: number) => Promise<void>;

  /** 새 일정을 추가하고 현재 뷰를 갱신한다. */
  addSchedule: (schedule: Schedule) => Promise<void>;

  /** 기존 일정을 수정하고 현재 뷰를 갱신한다. */
  updateSchedule: (schedule: Schedule) => Promise<void>;

  /** 일정을 삭제하고 현재 뷰를 갱신한다. */
  deleteSchedule: (id: string) => Promise<void>;

  /** Supabase 실시간 구독을 시작한다. 반환된 채널로 구독 해제 가능. */
  setupRealtimeSubscription: () => RealtimeChannel;
}

// ─────────────────────────────────────────────
// Zustand 스토어
// ─────────────────────────────────────────────

const todayInit = getTodayString();
const { year: initYear, month: initMonth } = parseYearMonth(todayInit);

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  selectedDate: todayInit,  // 초기엔 오늘 날짜 선택
  viewYear: initYear,
  viewMonth: initMonth,
  markedDates: {},
  rangeEvents: [],

  // ── 날짜 선택 ─────────────────────────────

  setSelectedDate: (date: string) => {
    const { year, month } = parseYearMonth(date);
    set({ selectedDate: date, viewYear: year, viewMonth: month });
    get().fetchByDate(date);
  },

  clearSelectedDate: async () => {
    const { viewYear, viewMonth } = get();
    set({ selectedDate: null });
    await get().fetchByMonth(viewYear, viewMonth);
  },

  // ── 조회 ────────────────────────────────

  fetchByDate: async (date: string) => {
    const schedules = await getSchedulesByDate(date);
    set({ schedules });
  },

  fetchByMonth: async (year: number, month: number) => {
    // 월 전체 일정을 조회한다 (과거 포함).
    // UI에서 오늘 이후 첫 일정으로 자동 스크롤하므로 DB 단에서는 필터링하지 않는다.
    const schedules = await getSchedulesByMonth(year, month);
    set({ schedules, viewYear: year, viewMonth: month });
  },

  fetchMarkedDates: async (year: number, month: number) => {
    const [rows, rangeEvents] = await Promise.all([
      getMarkedDates(year, month),
      getMultiDayEventsForMonth(year, month),
    ]);
    const markedDates: Record<string, string[]> = {};
    rows.forEach((r) => { markedDates[r.date] = r.colors; });
    set({ markedDates, rangeEvents });
  },

  // ── 추가 ───────────────────────────────

  addSchedule: async (schedule: Schedule) => {
    await insertSchedule(schedule);

    const { selectedDate, viewYear, viewMonth } = get();
    if (selectedDate !== null) {
      // 날짜 선택 모드: 선택된 날짜와 같으면 갱신
      if (schedule.date === selectedDate) await get().fetchByDate(selectedDate);
    } else {
      // 월 전체 보기 모드: 현재 월이면 갱신
      const { year, month } = parseYearMonth(schedule.date);
      if (year === viewYear && month === viewMonth) await get().fetchByMonth(year, month);
    }

    const { year, month } = parseYearMonth(schedule.date);
    await get().fetchMarkedDates(year, month);
  },

  // ── 수정 ───────────────────────────────

  updateSchedule: async (schedule: Schedule) => {
    // 수정 전: 기존 알람 전부 취소 (구형 단일 + 신형 복수 + 반복 알람)
    const existing = get().schedules.find((s) => s.id === schedule.id);
    await Notifications.cancelScheduledNotificationAsync(schedule.id).catch(() => {});
    const existingAlarmCount = existing?.alarmTimes?.length ?? 0;
    for (let i = 0; i < existingAlarmCount; i++) {
      await Notifications.cancelScheduledNotificationAsync(`${schedule.id}_${i}`).catch(() => {});
    }
    await cancelRepeatAlarms(schedule.id, existingAlarmCount);

    await dbUpdateSchedule(schedule);

    const { selectedDate, viewYear, viewMonth } = get();
    if (selectedDate !== null) {
      if (schedule.date === selectedDate) await get().fetchByDate(selectedDate);
    } else {
      const { year, month } = parseYearMonth(schedule.date);
      if (year === viewYear && month === viewMonth) await get().fetchByMonth(year, month);
    }

    const { year, month } = parseYearMonth(schedule.date);
    await get().fetchMarkedDates(year, month);
  },

  // ── 삭제 ───────────────────────────────

  deleteSchedule: async (id: string) => {
    const target = get().schedules.find((s) => s.id === id);

    // 구형 단일 알람 ID 취소 (하위 호환)
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    // 신형 복수 알람 ID 취소: {id}_{index} 패턴
    const alarmCount = target?.alarmTimes?.length ?? 0;
    for (let i = 0; i < alarmCount; i++) {
      await Notifications.cancelScheduledNotificationAsync(`${id}_${i}`).catch(() => {});
    }
    // 반복 알람 취소: {id}_repeat_{index} 패턴
    await cancelRepeatAlarms(id, alarmCount);

    await dbDeleteSchedule(id);

    const { selectedDate, viewYear, viewMonth } = get();
    if (selectedDate !== null) {
      await get().fetchByDate(selectedDate);
    } else {
      await get().fetchByMonth(viewYear, viewMonth);
    }

    const dateToRefresh = target?.date ?? selectedDate ?? `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
    const { year, month } = parseYearMonth(dateToRefresh);
    await get().fetchMarkedDates(year, month);
  },

  // ── 실시간 구독 ──────────────────────────────

  setupRealtimeSubscription: () => {
    const channel = supabase
      .channel('schedules_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          // 상대방이 일정을 추가/수정/삭제하면 현재 뷰를 자동 갱신
          const { selectedDate, viewYear, viewMonth } = get();
          if (selectedDate !== null) {
            get().fetchByDate(selectedDate).catch(() => {});
          } else {
            get().fetchByMonth(viewYear, viewMonth).catch(() => {});
          }
          get().fetchMarkedDates(viewYear, viewMonth).catch(() => {});
        },
      )
      .subscribe();
    return channel;
  },
}));
