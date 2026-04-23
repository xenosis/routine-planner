import { supabase } from '../lib/supabase';
import { getNameColor, NAME_TAG_DEFAULT_COLOR } from '../utils/nameTag';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface Schedule {
  id: string;
  title: string;
  date: string;         // YYYY-MM-DD (시작일)
  endDate?: string;     // YYYY-MM-DD (종료일), 단일 일정이면 undefined
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  category: '업무' | '개인' | '건강' | '기타';
  color: string;
  memo?: string;
  alarm: boolean;
  alarmTimes?: number[];  // 알람 시간 배열 (분 단위)
  location?: string;
  nameTag?: string;
  nameTagColor?: string;
}

// ─────────────────────────────────────────────
// Supabase row → Schedule 변환 헬퍼
// ─────────────────────────────────────────────

// Supabase는 JSONB 컬럼을 이미 파싱된 값으로 반환한다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSchedule(row: any): Schedule {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.endDate ?? undefined,
    startTime: row.startTime,
    endTime: row.endTime,
    category: row.category as Schedule['category'],
    color: row.color,
    memo: row.memo ?? undefined,
    alarm: Boolean(row.alarm),
    alarmTimes: Array.isArray(row.alarmTimes) && row.alarmTimes.length > 0
      ? (row.alarmTimes as number[])
      : undefined,
    location: row.location ?? undefined,
    nameTag: row.participants ?? undefined,
    nameTagColor: row.nameTagColor ?? undefined,
  };
}

// Schedule → Supabase insert/update payload
function scheduleToRow(schedule: Schedule) {
  return {
    id: schedule.id,
    title: schedule.title,
    date: schedule.date,
    // date와 같으면 null 저장 (단일 일정)
    endDate: schedule.endDate && schedule.endDate !== schedule.date ? schedule.endDate : null,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    category: schedule.category,
    color: schedule.color,
    memo: schedule.memo ?? null,
    alarm: schedule.alarm,
    alarmTimes: schedule.alarmTimes ?? [],
    location: schedule.location ?? null,
    participants: schedule.nameTag ?? null,
    nameTagColor: schedule.nameTagColor ?? null,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수 (scheduleStore와 인터페이스 동일 유지)
// ─────────────────────────────────────────────

export async function getSchedulesByDate(date: string): Promise<Schedule[]> {
  // 시작일 <= 선택날짜 AND (단일일이면 date=선택날짜 / 범위면 endDate >= 선택날짜)
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .lte('date', date)
    .or(`and(endDate.is.null,date.eq.${date}),and(endDate.not.is.null,endDate.gte.${date})`)
    .order('startTime', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSchedule);
}

export async function getMarkedDates(
  year: number,
  month: number,
): Promise<{ date: string; colors: string[] }[]> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('schedules')
    .select('date, participants, nameTagColor')
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) throw new Error(error.message);

  // 날짜별 이름표 색상 집계 (중복 색상 제거)
  // nameTagColor 저장값 우선, 없으면 이름 해시 fallback
  const colorMap = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if (!colorMap.has(row.date)) colorMap.set(row.date, new Set());
    const color = row.nameTagColor ?? (row.participants ? getNameColor(row.participants) : NAME_TAG_DEFAULT_COLOR);
    colorMap.get(row.date)!.add(color);
  }
  return Array.from(colorMap.entries())
    .map(([date, colorSet]) => ({ date, colors: Array.from(colorSet) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 해당 월과 겹치는 범위 이벤트(endDate가 있는 일정)를 반환한다.
 * MonthCalendar의 range bar 렌더링에 사용.
 */
export async function getMultiDayEventsForMonth(
  year: number,
  month: number,
): Promise<{ startDate: string; endDate: string; color: string }[]> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('schedules')
    .select('date, endDate, color')
    .not('endDate', 'is', null)
    .lt('date', nextMonthStart)
    .gte('endDate', startDate);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.endDate && row.endDate !== row.date)
    .map((row) => ({
      startDate: row.date as string,
      endDate: row.endDate as string,
      color: row.color as string,
    }));
}

export async function insertSchedule(schedule: Schedule): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .insert(scheduleToRow(schedule));

  if (error) throw new Error(error.message);
}

export async function updateSchedule(schedule: Schedule): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update(scheduleToRow(schedule))
    .eq('id', schedule.id);

  if (error) throw new Error(error.message);
}

export async function getSchedulesByMonth(
  year: number,
  month: number,
): Promise<Schedule[]> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // date < 다음달1일 AND (단일일이면 date >= 이번달1일 / 범위면 endDate >= 이번달1일)
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .lt('date', nextMonthStart)
    .or(`and(endDate.is.null,date.gte.${startDate}),and(endDate.not.is.null,endDate.gte.${startDate})`)
    .order('date', { ascending: true })
    .order('startTime', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSchedule);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export type { Schedule as ScheduleType };
