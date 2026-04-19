import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface Schedule {
  id: string;
  title: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  category: '업무' | '개인' | '건강' | '기타';
  color: string;
  memo?: string;
  alarm: boolean;
  alarmTimes?: number[];  // 알람 시간 배열 (분 단위)
  location?: string;
  participants?: string;
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
    participants: row.participants ?? undefined,
  };
}

// Schedule → Supabase insert/update payload
function scheduleToRow(schedule: Schedule) {
  return {
    id: schedule.id,
    title: schedule.title,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    category: schedule.category,
    color: schedule.color,
    memo: schedule.memo ?? null,
    alarm: schedule.alarm,
    alarmTimes: schedule.alarmTimes ?? [],
    location: schedule.location ?? null,
    participants: schedule.participants ?? null,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수 (scheduleStore와 인터페이스 동일 유지)
// ─────────────────────────────────────────────

export async function getSchedulesByDate(date: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('date', date)
    .order('startTime', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSchedule);
}

export async function getMarkedDates(
  year: number,
  month: number,
): Promise<{ date: string; count: number }[]> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('schedules')
    .select('date')
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) throw new Error(error.message);

  // 클라이언트에서 날짜별 개수 집계
  const countMap = new Map<string, number>();
  for (const row of data ?? []) {
    countMap.set(row.date, (countMap.get(row.date) ?? 0) + 1);
  }
  return Array.from(countMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', startDate)
    .lt('date', endDate)
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
