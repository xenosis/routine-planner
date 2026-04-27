import type { RoutineScheduleInfo } from '../db/achievementDb';

/** YYYY-MM-DD 에서 N일 전 날짜 문자열 반환 */
export function getDateBefore(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 에서 요일 두 글자 반환 (월, 화, 수, ...) */
export function getDayLabel(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
}

/** 날짜 문자열의 월요일(주 시작일) 반환 (로컬 타임존 기준) */
export function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(y, m - 1, d - daysFromMon);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
}

/** 이번 주 월요일 ~ 오늘까지의 날짜 문자열 배열 반환 (1~7일) */
export function getThisWeekDays(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const dates: string[] = [];
  for (let i = daysFromMon; i >= 0; i--) {
    dates.push(getDateBefore(today, i));
  }
  return dates;
}

/**
 * 특정 날짜에 예정된 루틴 수를 계산한다.
 * - daily / weekly_count: 항상 예정 (단, quotaMetIds에 포함된 weekly_count는 제외)
 * - weekly_days: 해당 날짜의 요일이 weekdays 배열에 포함될 때만 예정
 * - 루틴 생성일(createdAt) 이후부터만 포함
 */
export function getScheduledCountForDate(
  date: string,
  routines: RoutineScheduleInfo[],
  quotaMetIds?: Set<string>,
): number {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return routines.filter((r) => {
    if (r.createdAt > date) return false;
    if (r.frequency === 'weekly_count') {
      if (quotaMetIds?.has(r.id)) return false;
      return true;
    }
    if (r.frequency === 'daily') return true;
    if (r.frequency === 'weekly_days') return r.weekdays?.includes(weekday) ?? false;
    return false;
  }).length;
}
