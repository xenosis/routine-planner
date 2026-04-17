import { getDb } from './database';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface Routine {
  id: string;
  title: string;
  category: '운동' | '공부' | '청소' | '관리' | '기타';
  color: string;
  frequency: 'daily' | 'weekly_days' | 'weekly_count';
  /** weekly_days: 루틴 예정 요일 / weekly_count: 알람 요일 (JS getDay() 기준: 0=일,...,6=토) */
  weekdays?: number[];
  /** 주 N회 목표 횟수 (weekly_count일 때만 유효, 2~6) */
  weeklyCount?: number;
  alarm: boolean;
  alarmTime?: string;   // HH:mm
  streak: number;
  createdAt: string;
}

// ─────────────────────────────────────────────
// DB 로우(row) → Routine 변환 헬퍼
// ─────────────────────────────────────────────

interface RoutineRow {
  id: string;
  title: string;
  category: string;
  color: string;
  frequency: string | null;
  weekdays: string | null;
  weekly_count: number | null;
  alarm: number;
  alarmTime: string | null;
  streak: number;
  createdAt: string;
}

function rowToRoutine(row: RoutineRow): Routine {
  let weekdays: number[] | undefined;
  if (row.weekdays) {
    try { weekdays = JSON.parse(row.weekdays) as number[]; } catch { weekdays = undefined; }
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category as Routine['category'],
    color: row.color,
    frequency: (row.frequency ?? 'daily') as Routine['frequency'],
    weekdays,
    weeklyCount: row.weekly_count ?? undefined,
    alarm: row.alarm === 1,
    alarmTime: row.alarmTime ?? undefined,
    streak: row.streak,
    createdAt: row.createdAt,
  };
}

// ─────────────────────────────────────────────
// CRUD 함수
// ─────────────────────────────────────────────

/**
 * 모든 루틴을 createdAt 오름차순으로 조회한다.
 */
export async function getAllRoutines(): Promise<Routine[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoutineRow>(
    'SELECT id, title, category, color, frequency, weekdays, weekly_count, alarm, alarmTime, streak, createdAt FROM routines ORDER BY createdAt ASC',
  );
  return rows.map(rowToRoutine);
}

/**
 * 특정 날짜에 완료된 루틴의 id 배열을 반환한다.
 */
export async function getCompletedIds(date: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ routineId: string }>(
    'SELECT routineId FROM routine_completions WHERE date = ?',
    [date],
  );
  return rows.map((r) => r.routineId);
}

/**
 * 새 루틴을 DB에 삽입한다.
 */
export async function insertRoutine(routine: Routine): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO routines (id, title, category, color, frequency, weekdays, weekly_count, alarm, alarmTime, streak, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      routine.id,
      routine.title,
      routine.category,
      routine.color,
      routine.frequency,
      routine.weekdays ? JSON.stringify(routine.weekdays) : null,
      routine.weeklyCount ?? null,
      routine.alarm ? 1 : 0,
      routine.alarmTime ?? null,
      routine.streak,
      routine.createdAt,
    ],
  );
}

/**
 * 기존 루틴을 업데이트한다. id를 기준으로 전체 컬럼을 갱신한다.
 */
export async function updateRoutine(routine: Routine): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE routines
     SET title = ?, category = ?, color = ?, frequency = ?, weekdays = ?, weekly_count = ?,
         alarm = ?, alarmTime = ?, streak = ?
     WHERE id = ?`,
    [
      routine.title,
      routine.category,
      routine.color,
      routine.frequency,
      routine.weekdays ? JSON.stringify(routine.weekdays) : null,
      routine.weeklyCount ?? null,
      routine.alarm ? 1 : 0,
      routine.alarmTime ?? null,
      routine.streak,
      routine.id,
    ],
  );
}

/**
 * 루틴을 삭제한다. 연관된 routine_completions 기록도 함께 삭제한다.
 */
export async function deleteRoutine(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM routines WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM routine_completions WHERE routineId = ?', [id]);
}

/**
 * 특정 날짜의 루틴 완료 상태를 토글한다.
 * 완료 기록이 없으면 INSERT, 있으면 DELETE한다.
 */
export async function toggleCompletion(
  routineId: string,
  date: string,
): Promise<void> {
  const db = await getDb();

  // 해당 날짜에 완료 기록이 있는지 확인
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM routine_completions WHERE routineId = ? AND date = ?',
    [routineId, date],
  );
  if (existing) {
    await db.runAsync('DELETE FROM routine_completions WHERE routineId = ? AND date = ?', [routineId, date]);
  } else {
    const completionId = `${routineId}_${date}`;
    await db.runAsync(
      'INSERT INTO routine_completions (id, routineId, date) VALUES (?, ?, ?)',
      [completionId, routineId, date],
    );
  }
}

/**
 * 특정 날짜에 완료된 루틴의 id 배열을 반환한다. (getCompletedIds의 별칭)
 */
export async function getCompletionsByDate(date: string): Promise<string[]> {
  return getCompletedIds(date);
}

/**
 * 이번 주(월~일) 완료 기록 조회 (routineId → 완료된 날짜 배열)
 */
export async function getWeekCompletions(
  weekStart: string,  // 이번 주 월요일 (YYYY-MM-DD)
  weekEnd: string,    // 이번 주 일요일 (YYYY-MM-DD)
): Promise<Record<string, string[]>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ routineId: string; date: string }>(
    'SELECT routineId, date FROM routine_completions WHERE date BETWEEN ? AND ? ORDER BY date ASC',
    [weekStart, weekEnd],
  );
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.routineId]) result[row.routineId] = [];
    result[row.routineId].push(row.date);
  }
  return result;
}

// ─────────────────────────────────────────────
// 스트릭 계산 헬퍼
// ─────────────────────────────────────────────

/**
 * YYYY-MM-DD 문자열에서 하루 이전 날짜를 반환한다.
 */
function getPreviousDate(dateStr: string): string {
  const date = new Date(dateStr);
  // UTC 기준으로 하루를 빼면 timezone 이슈가 없다
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * weekly_days 루틴에서 현재 날짜 이전 예정일을 찾는다.
 * 최대 7일 전까지 역방향으로 탐색한다.
 */
function getPrevScheduledDate(dateStr: string, weekdays: number[]): string | null {
  const date = new Date(dateStr);
  for (let i = 1; i <= 7; i++) {
    date.setUTCDate(date.getUTCDate() - 1);
    const dayOfWeek = date.getUTCDay();
    if (weekdays.includes(dayOfWeek)) {
      return date.toISOString().split('T')[0];
    }
  }
  return null;
}

/**
 * 특정 루틴의 현재 스트릭을 계산한다.
 * - daily: 오늘(또는 어제)부터 역산하며 연속 완료된 날 수 반환
 * - weekly_days: 예정된 요일만 역산하며 연속 완료된 회수 반환
 * - weekly_count: 주 단위로 역산하며 연속으로 quota 달성한 주 수 반환
 */
export async function calculateStreak(
  routineId: string,
  weekdays?: number[],
  weeklyCount?: number,
): Promise<number> {
  const db = await getDb();

  // 완료된 날짜를 내림차순으로 모두 가져온다
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM routine_completions WHERE routineId = ? ORDER BY date DESC',
    [routineId],
  );

  if (rows.length === 0) return 0;

  // 완료 날짜를 Set으로 변환하여 O(1) 조회 가능하게 한다
  const completedDates = new Set(rows.map((r) => r.date));
  const today = new Date().toISOString().split('T')[0];

  if (weeklyCount && weeklyCount > 0) {
    // weekly_count: 주 단위 역산 — 연속으로 quota를 달성한 주 수를 반환

    function getWeekStart(dateStr: string): string {
      const d = new Date(dateStr + 'T00:00:00Z');
      const day = d.getUTCDay(); // 0=일
      const diff = day === 0 ? 6 : day - 1; // 월요일 기준
      d.setUTCDate(d.getUTCDate() - diff);
      return d.toISOString().split('T')[0];
    }
    function getPrevWeekStart(ws: string): string {
      const d = new Date(ws + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().split('T')[0];
    }

    // 주별 완료 횟수 맵 구성
    const weekCountMap: Record<string, number> = {};
    for (const d of completedDates) {
      const ws = getWeekStart(d);
      weekCountMap[ws] = (weekCountMap[ws] ?? 0) + 1;
    }

    // 이번 주부터 역산하여 연속 달성 주 수 카운트
    let streak = 0;
    let checkWeek = getWeekStart(today);
    while ((weekCountMap[checkWeek] ?? 0) >= weeklyCount) {
      streak++;
      checkWeek = getPrevWeekStart(checkWeek);
    }
    return streak;
  }

  if (weekdays && weekdays.length > 0) {
    // weekly_days: 예정된 날짜만 역산하며 스트릭 계산
    // 오늘이 예정일인지 확인
    const todayJsDay = new Date().getUTCDay();
    const todayIsScheduled = weekdays.includes(todayJsDay);
    const startDate = (todayIsScheduled && completedDates.has(today))
      ? today
      : getPrevScheduledDate(today, weekdays);

    if (!startDate || !completedDates.has(startDate)) return 0;

    let streak = 0;
    let currentDate: string | null = startDate;
    while (currentDate && completedDates.has(currentDate)) {
      streak++;
      currentDate = getPrevScheduledDate(currentDate, weekdays);
    }
    return streak;
  } else {
    // daily: 기존 로직 유지
    // 오늘 완료 여부에 따라 시작 기준일 결정
    const startDate = completedDates.has(today) ? today : getPreviousDate(today);

    // 기준일도 완료되지 않았으면 스트릭 0
    if (!completedDates.has(startDate)) return 0;

    // 연속 날짜 카운트
    let streak = 0;
    let currentDate = startDate;
    while (completedDates.has(currentDate)) {
      streak++;
      currentDate = getPreviousDate(currentDate);
    }
    return streak;
  }
}

/**
 * 루틴의 streak 컬럼만 업데이트한다.
 * calculateStreak 결과를 DB에 반영할 때 사용한다.
 */
export async function updateStreak(
  routineId: string,
  streak: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE routines SET streak = ? WHERE id = ?', [streak, routineId]);
}
