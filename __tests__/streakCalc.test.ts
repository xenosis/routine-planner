import { calculateStreakFromDates } from '../src/utils/streakCalc';

// 날짜 기준: 2026-04-27 = 월요일 (UTC 기준)
const TODAY = '2026-04-27'; // 월

describe('calculateStreakFromDates - daily', () => {
  test('완료 없으면 0', () => {
    expect(calculateStreakFromDates(new Set(), TODAY)).toBe(0);
  });

  test('오늘만 완료하면 1', () => {
    expect(calculateStreakFromDates(new Set([TODAY]), TODAY)).toBe(1);
  });

  test('어제만 완료해도 1 (오늘 미완료)', () => {
    expect(calculateStreakFromDates(new Set(['2026-04-26']), TODAY)).toBe(1);
  });

  test('3일 연속 완료하면 3', () => {
    const dates = new Set(['2026-04-25', '2026-04-26', TODAY]);
    expect(calculateStreakFromDates(dates, TODAY)).toBe(3);
  });

  test('2일 전 갭 → 0 (어제 미완료)', () => {
    expect(calculateStreakFromDates(new Set(['2026-04-25']), TODAY)).toBe(0);
  });

  test('중간에 갭 있으면 갭 이후부터 카운트', () => {
    // 오늘(27), 어제(26) 완료. 25일은 빠지고 24일 있음 → 오늘+어제 = 2
    const dates = new Set(['2026-04-24', '2026-04-26', TODAY]);
    expect(calculateStreakFromDates(dates, TODAY)).toBe(2);
  });
});

describe('calculateStreakFromDates - weekly_days', () => {
  // 월요일(1) 루틴
  const MON_DAYS = [1];

  test('완료 없으면 0', () => {
    expect(calculateStreakFromDates(new Set(), TODAY, MON_DAYS)).toBe(0);
  });

  test('오늘(월) 완료하면 1', () => {
    expect(calculateStreakFromDates(new Set([TODAY]), TODAY, MON_DAYS)).toBe(1);
  });

  test('2주 연속 월요일 완료하면 2', () => {
    const dates = new Set(['2026-04-20', TODAY]); // 지난 월, 이번 월
    expect(calculateStreakFromDates(dates, TODAY, MON_DAYS)).toBe(2);
  });

  test('예정 요일 아닌 오늘에는 이전 예정일로 거슬러 계산', () => {
    // 화요일 기준, 월요일(1) 루틴 — 이번 주 월요일 완료 시 streak=1
    expect(calculateStreakFromDates(new Set([TODAY]), '2026-04-28', MON_DAYS)).toBe(1);
  });

  test('가장 최근 예정일 미완료 시 0', () => {
    // 이번 월(27일) 미완료, 지난 월(20일)도 미완료, 2주 전(13일)만 완료
    expect(calculateStreakFromDates(new Set(['2026-04-13']), TODAY, MON_DAYS)).toBe(0);
  });
});

describe('calculateStreakFromDates - weekly_count', () => {
  const QUOTA = 2;

  test('완료 없으면 0', () => {
    expect(calculateStreakFromDates(new Set(), TODAY, undefined, QUOTA)).toBe(0);
  });

  test('이번 주 quota 미달(1회) 시 0', () => {
    expect(calculateStreakFromDates(new Set([TODAY]), TODAY, undefined, QUOTA)).toBe(0);
  });

  test('이번 주 quota 달성(2회) 시 1', () => {
    const dates = new Set([TODAY, '2026-04-28']);
    expect(calculateStreakFromDates(dates, '2026-04-29', undefined, QUOTA)).toBe(1);
  });

  test('2주 연속 quota 달성 시 2', () => {
    const dates = new Set([
      '2026-04-20', '2026-04-21', // 지난 주 2회
      TODAY, '2026-04-28',        // 이번 주 2회
    ]);
    expect(calculateStreakFromDates(dates, '2026-04-29', undefined, QUOTA)).toBe(2);
  });

  test('이번 주 달성, 지난 주 미달성 시 1', () => {
    // 지난 주 1회만 완료 (미달성), 이번 주 2회 완료
    const dates = new Set(['2026-04-22', TODAY, '2026-04-28']);
    expect(calculateStreakFromDates(dates, '2026-04-29', undefined, QUOTA)).toBe(1);
  });
});
