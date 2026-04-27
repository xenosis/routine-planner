import {
  getDateBefore,
  getDayLabel,
  getWeekStart,
  getThisWeekDays,
  getScheduledCountForDate,
} from '../src/utils/achievementCalc';
import type { RoutineScheduleInfo } from '../src/db/achievementDb';

// 날짜 기준: 2026-04-27 = 월요일
const MON = '2026-04-27';
const TUE = '2026-04-28';
const WED = '2026-04-29';
const SUN = '2026-05-03';

describe('getDateBefore', () => {
  test('0일 전은 자신', () => {
    expect(getDateBefore(MON, 0)).toBe(MON);
  });
  test('1일 전', () => {
    expect(getDateBefore(TUE, 1)).toBe(MON);
  });
  test('월 경계 넘기기', () => {
    expect(getDateBefore('2026-05-01', 1)).toBe('2026-04-30');
  });
});

describe('getDayLabel', () => {
  test('월요일', () => expect(getDayLabel(MON)).toBe('월'));
  test('화요일', () => expect(getDayLabel(TUE)).toBe('화'));
  test('수요일', () => expect(getDayLabel(WED)).toBe('수'));
  test('일요일', () => expect(getDayLabel(SUN)).toBe('일'));
});

describe('getWeekStart', () => {
  test('월요일은 자신이 주 시작일', () => {
    expect(getWeekStart(MON)).toBe(MON);
  });
  test('화요일 → 해당 주 월요일', () => {
    expect(getWeekStart(TUE)).toBe(MON);
  });
  test('수요일 → 해당 주 월요일', () => {
    expect(getWeekStart(WED)).toBe(MON);
  });
  test('일요일은 6일 전 월요일', () => {
    expect(getWeekStart(SUN)).toBe(MON);
  });
  test('월 경계 넘기기 (5월 2일 토 → 4월 27일 월)', () => {
    expect(getWeekStart('2026-05-02')).toBe(MON);
  });
});

describe('getThisWeekDays', () => {
  test('월요일이면 자신만 반환', () => {
    expect(getThisWeekDays(MON)).toEqual([MON]);
  });
  test('화요일이면 월~화 2일 반환', () => {
    expect(getThisWeekDays(TUE)).toEqual([MON, TUE]);
  });
  test('수요일이면 월~수 3일 반환', () => {
    expect(getThisWeekDays(WED)).toEqual([MON, TUE, WED]);
  });
  test('일요일이면 월~일 7일 반환', () => {
    expect(getThisWeekDays(SUN)).toHaveLength(7);
    expect(getThisWeekDays(SUN)[0]).toBe(MON);
    expect(getThisWeekDays(SUN)[6]).toBe(SUN);
  });
});

describe('getScheduledCountForDate', () => {
  const daily: RoutineScheduleInfo = {
    id: 'r-daily', frequency: 'daily', weekdays: null, weeklyCount: null, createdAt: '2026-01-01',
  };
  // 화요일(2)만 예정
  const wdTue: RoutineScheduleInfo = {
    id: 'r-tue', frequency: 'weekly_days', weekdays: [2], weeklyCount: null, createdAt: '2026-01-01',
  };
  const wc2: RoutineScheduleInfo = {
    id: 'r-wc', frequency: 'weekly_count', weekdays: null, weeklyCount: 2, createdAt: '2026-01-01',
  };
  const newRoutine: RoutineScheduleInfo = {
    id: 'r-new', frequency: 'daily', weekdays: null, weeklyCount: null, createdAt: '2026-05-01',
  };

  test('daily 루틴은 항상 집계', () => {
    expect(getScheduledCountForDate(MON, [daily])).toBe(1);
    expect(getScheduledCountForDate(TUE, [daily])).toBe(1);
  });

  test('weekly_days - 해당 요일(화)이면 집계', () => {
    expect(getScheduledCountForDate(TUE, [wdTue])).toBe(1);
  });

  test('weekly_days - 해당 요일 아니면(월) 집계 안 함', () => {
    expect(getScheduledCountForDate(MON, [wdTue])).toBe(0);
  });

  test('weekly_count - quotaMetIds 없으면 집계', () => {
    expect(getScheduledCountForDate(MON, [wc2])).toBe(1);
  });

  test('weekly_count - quotaMetIds에 있으면 제외', () => {
    expect(getScheduledCountForDate(MON, [wc2], new Set(['r-wc']))).toBe(0);
  });

  test('생성일 이전 날짜는 제외', () => {
    expect(getScheduledCountForDate('2026-04-30', [newRoutine])).toBe(0);
  });

  test('생성일 당일부터 포함', () => {
    expect(getScheduledCountForDate('2026-05-01', [newRoutine])).toBe(1);
  });

  test('여러 루틴 혼합', () => {
    // 월요일: daily(1) + weekly_count(1) = 2, weekly_days(화) 제외
    expect(getScheduledCountForDate(MON, [daily, wdTue, wc2])).toBe(2);
    // 화요일: daily(1) + weekly_days(1) + weekly_count(1) = 3
    expect(getScheduledCountForDate(TUE, [daily, wdTue, wc2])).toBe(3);
  });
});
