import { supabase } from '../lib/supabase';
import { getNameColor, NAME_TAG_DEFAULT_COLOR } from '../utils/nameTag';
import { matchesRepeatDate } from '../utils/repeatDate';
export { matchesRepeatDate } from '../utils/repeatDate';

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
  category: string;
  color: string;
  memo?: string;
  alarm: boolean;
  alarmTimes?: number[];  // 알람 시간 배열 (분 단위)
  location?: string;
  nameTag?: string;
  nameTagColor?: string;
  repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  repeatUntil?: string;  // YYYY-MM-DD (반복 종료일, 없으면 무한)
}

// ─────────────────────────────────────────────
// Supabase row → Schedule 변환 헬퍼
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSchedule(row: any): Schedule {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.endDate ?? undefined,
    startTime: row.startTime,
    endTime: row.endTime,
    category: row.category,
    color: row.color,
    memo: row.memo ?? undefined,
    alarm: Boolean(row.alarm),
    alarmTimes: Array.isArray(row.alarmTimes) && row.alarmTimes.length > 0
      ? (row.alarmTimes as number[])
      : undefined,
    location: row.location ?? undefined,
    nameTag: row.participants ?? undefined,
    nameTagColor: row.nameTagColor ?? undefined,
    repeat: (row.repeat && row.repeat !== 'none') ? row.repeat as Schedule['repeat'] : undefined,
    repeatUntil: row.repeatUntil ?? undefined,
  };
}

// Schedule → Supabase insert/update payload
function scheduleToRow(schedule: Schedule) {
  return {
    id: schedule.id,
    title: schedule.title,
    date: schedule.date,
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
    repeat: schedule.repeat ?? 'none',
    repeatUntil: schedule.repeatUntil ?? null,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수
// ─────────────────────────────────────────────

export async function getSchedulesByDate(date: string): Promise<Schedule[]> {
  // 비반복 일정: 기존 날짜 범위 쿼리
  const { data: nonRepeat, error: e1 } = await supabase
    .from('schedules')
    .select('*')
    .or('repeat.is.null,repeat.eq.none')
    .lte('date', date)
    .or(`and(endDate.is.null,date.eq.${date}),and(endDate.not.is.null,endDate.gte.${date})`)
    .order('startTime', { ascending: true });

  if (e1) throw new Error(e1.message);

  // 반복 일정: 시작일 <= 날짜 AND (repeatUntil 없음 OR repeatUntil >= 날짜)
  const { data: repeatRows, error: e2 } = await supabase
    .from('schedules')
    .select('*')
    .not('repeat', 'is', null)
    .neq('repeat', 'none')
    .lte('date', date)
    .or(`repeatUntil.is.null,repeatUntil.gte.${date}`);

  if (e2) throw new Error(e2.message);

  // 반복 패턴이 해당 날짜와 일치하는 것만 필터
  const matchingRepeat = (repeatRows ?? []).filter((row) =>
    matchesRepeatDate(row.repeat, row.date, date),
  );

  const all = [
    ...(nonRepeat ?? []).map(rowToSchedule),
    ...matchingRepeat.map(rowToSchedule),
  ];
  return all.sort((a, b) => a.startTime.localeCompare(b.startTime));
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

  // 비반복 일정 (기존 쿼리)
  const { data: nonRepeat, error: e1 } = await supabase
    .from('schedules')
    .select('date, endDate, participants, nameTagColor')
    .or('repeat.is.null,repeat.eq.none')
    .gte('date', startDate)
    .lt('date', endDate);

  if (e1) throw new Error(e1.message);

  // 반복 일정: 이번 달과 겹치는 것
  const { data: repeatRows, error: e2 } = await supabase
    .from('schedules')
    .select('date, participants, nameTagColor, repeat, repeatUntil')
    .not('repeat', 'is', null)
    .neq('repeat', 'none')
    .lt('date', endDate)
    .or(`repeatUntil.is.null,repeatUntil.gte.${startDate}`);

  if (e2) throw new Error(e2.message);

  const colorMap = new Map<string, Set<string>>();

  // 비반복 일정 처리 — 여러날 일정(endDate > date)은 bar로 표시되므로 dot 제외
  for (const row of nonRepeat ?? []) {
    if (row.endDate && row.endDate !== row.date) continue;
    if (!colorMap.has(row.date)) colorMap.set(row.date, new Set());
    const color = row.nameTagColor ?? (row.participants ? getNameColor(row.participants) : NAME_TAG_DEFAULT_COLOR);
    colorMap.get(row.date)!.add(color);
  }

  // 반복 일정 전개: 해당 월의 각 날짜 중 패턴과 일치하는 날짜에 dot 추가
  const daysInMonth = new Date(year, month, 0).getDate();
  for (const row of repeatRows ?? []) {
    const color = row.nameTagColor ?? (row.participants ? getNameColor(row.participants) : NAME_TAG_DEFAULT_COLOR);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
      if (row.repeatUntil && dateStr > row.repeatUntil) break;
      if (matchesRepeatDate(row.repeat, row.date, dateStr)) {
        if (!colorMap.has(dateStr)) colorMap.set(dateStr, new Set());
        colorMap.get(dateStr)!.add(color);
      }
    }
  }

  return Array.from(colorMap.entries())
    .map(([date, colorSet]) => ({ date, colors: Array.from(colorSet) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

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
    .or('repeat.is.null,repeat.eq.none')
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

  // 비반복 일정
  const { data: nonRepeat, error: e1 } = await supabase
    .from('schedules')
    .select('*')
    .or('repeat.is.null,repeat.eq.none')
    .lt('date', nextMonthStart)
    .or(`and(endDate.is.null,date.gte.${startDate}),and(endDate.not.is.null,endDate.gte.${startDate})`)
    .order('date', { ascending: true })
    .order('startTime', { ascending: true });

  if (e1) throw new Error(e1.message);

  // 반복 일정: 이번 달과 겹치는 것
  const { data: repeatRows, error: e2 } = await supabase
    .from('schedules')
    .select('*')
    .not('repeat', 'is', null)
    .neq('repeat', 'none')
    .lt('date', nextMonthStart)
    .or(`repeatUntil.is.null,repeatUntil.gte.${startDate}`);

  if (e2) throw new Error(e2.message);

  // 반복 일정을 이번 달에 발생하는 날짜들로 전개
  const daysInMonth = new Date(year, month, 0).getDate();
  const expandedRepeat: Schedule[] = [];

  for (const row of repeatRows ?? []) {
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
      if (row.repeatUntil && dateStr > row.repeatUntil) break;
      if (matchesRepeatDate(row.repeat, row.date, dateStr)) {
        expandedRepeat.push({ ...rowToSchedule(row), date: dateStr });
      }
    }
  }

  const all = [...(nonRepeat ?? []).map(rowToSchedule), ...expandedRepeat];
  return all.sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
}

// 단일 일정 조회 (반복 알람 재등록 등에서 사용)
export async function getScheduleById(id: string): Promise<Schedule | null> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return rowToSchedule(data);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// 앱 시작 시 반복 알람 재등록 체크용
export async function getRepeatSchedulesWithAlarm(): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .not('repeat', 'is', null)
    .neq('repeat', 'none')
    .eq('alarm', true);

  if (error) return [];
  return (data ?? []).map(rowToSchedule);
}

/**
 * 위젯 동기화용: startYear/startMonth ~ endYear/endMonth 범위 내 모든 일정을
 * 월별 Map으로 반환한다. 단일 쿼리로 처리해 네트워크 요청을 최소화한다.
 */
export async function getSchedulesForWidgetSync(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number,
): Promise<Map<string, Schedule[]>> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${startYear}-${pad(startMonth)}-01`;
  const endMonthDays = new Date(endYear, endMonth, 0).getDate();
  const endDate = `${endYear}-${pad(endMonth)}-${pad(endMonthDays)}`;

  const { data: nonRepeat, error: e1 } = await supabase
    .from('schedules')
    .select('*')
    .or('repeat.is.null,repeat.eq.none')
    .lte('date', endDate)
    .or(`and(endDate.is.null,date.gte.${startDate}),and(endDate.not.is.null,endDate.gte.${startDate})`);

  if (e1) throw new Error(e1.message);

  const { data: repeatRows, error: e2 } = await supabase
    .from('schedules')
    .select('*')
    .not('repeat', 'is', null)
    .neq('repeat', 'none')
    .lte('date', endDate)
    .or(`repeatUntil.is.null,repeatUntil.gte.${startDate}`);

  if (e2) throw new Error(e2.message);

  // 월별 Map 초기화
  const result = new Map<string, Schedule[]>();
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    result.set(`${y}-${pad(m)}`, []);
    if (m === 12) { y++; m = 1; } else { m++; }
  }

  // 비반복 일정 분류
  for (const row of nonRepeat ?? []) {
    const s = rowToSchedule(row);
    if (s.endDate) {
      // 여러날 일정: 겹치는 달마다 원본 그대로 추가 (Kotlin에서 범위 체크)
      for (const [key] of result) {
        const [ky, km] = key.split('-').map(Number);
        const mStart = `${key}-01`;
        const mEnd = `${key}-${pad(new Date(ky, km, 0).getDate())}`;
        if (s.date <= mEnd && s.endDate >= mStart) {
          result.get(key)!.push(s);
        }
      }
    } else {
      const key = s.date.substring(0, 7);
      result.get(key)?.push(s);
    }
  }

  // 반복 일정 전개
  for (const row of repeatRows ?? []) {
    let cy = startYear, cm = startMonth;
    while (cy < endYear || (cy === endYear && cm <= endMonth)) {
      const monthStr = pad(cm);
      const key = `${cy}-${monthStr}`;
      const daysInMonth = new Date(cy, cm, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${cy}-${monthStr}-${pad(day)}`;
        if (row.repeatUntil && dateStr > row.repeatUntil) break;
        if (dateStr < row.date) continue;
        if (matchesRepeatDate(row.repeat, row.date, dateStr)) {
          result.get(key)?.push({ ...rowToSchedule(row), date: dateStr });
        }
      }
      if (cm === 12) { cy++; cm = 1; } else { cm++; }
    }
  }

  for (const schedules of result.values()) {
    schedules.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }

  return result;
}

export type { Schedule as ScheduleType };
